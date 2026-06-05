using CakeIS.Api.Data;
using CakeIS.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace CakeIS.Api.Controllers;

public class CartItemDto
{
    public int CakeId { get; set; }
    public int Quantity { get; set; } = 1;
    public string? CustomDescription { get; set; }
}

public class PlaceOrderDto
{
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public bool IsWhatsApp { get; set; }
    
    // Multi-item cart checkout
    public List<CartItemDto> Items { get; set; } = new();
    
    // Legacy single-item (custom cake / direct order)
    public int CakeId { get; set; }
    public string? CustomDescription { get; set; }
    public int Quantity { get; set; } = 1;
    
    public DateTime FulfillmentDate { get; set; }
    public string DeliveryMethod { get; set; } = "Collection";
    public string? DeliveryAddress { get; set; }
}

[ApiController]
[Route("api/[controller]")]
    public class OrdersController : ControllerBase
    {
        private readonly CakeDbContext _context;
        private readonly CakeIS.Api.Services.IWhatsAppService _whatsapp;

        public OrdersController(CakeDbContext context, CakeIS.Api.Services.IWhatsAppService whatsapp)
        {
            _context = context;
            _whatsapp = whatsapp;
        }

    [Authorize]
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Order>>> GetOrders()
    {
        return await _context.Orders
            .Include(o => o.Customer)
            .Include(o => o.OrderItems)
            .ThenInclude(oi => oi.Cake)
            .ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Order>> GetOrder(int id)
    {
        var order = await _context.Orders
            .Include(o => o.Customer)
            .Include(o => o.OrderItems)
            .ThenInclude(oi => oi.Cake)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null)
        {
            return NotFound();
        }

        return order;
    }

    public class UpdateStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }

    [Authorize]
    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateStatusDto dto)
    {
        var order = await _context.Orders
            .Include(o => o.OrderItems)
            .FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound("Order not found.");

        order.Status = dto.Status;
        foreach (var item in order.OrderItems)
        {
            item.Status = dto.Status;
        }
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [Authorize]
    [HttpPut("{orderId}/items/{itemId}/status")]
    public async Task<IActionResult> UpdateOrderItemStatus(int orderId, int itemId, [FromBody] UpdateStatusDto dto)
    {
        var item = await _context.OrderItems
            .FirstOrDefaultAsync(oi => oi.Id == itemId && oi.OrderId == orderId);
        if (item == null) return NotFound("Order item not found.");

        item.Status = dto.Status;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    public class UpdateResponseDto
    {
        public string Response { get; set; } = string.Empty;
    }

    [Authorize]
    [HttpPut("{id}/response")]
    public async Task<IActionResult> UpdateOrderResponse(int id, [FromBody] UpdateResponseDto dto)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound("Order not found.");

        order.AdminResponse = dto.Response;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("booked-dates")]
    public async Task<ActionResult<IEnumerable<string>>> GetBookedDates()
    {
        // Example logic: if the date has 3 or more cakes ordered across all orders, mark as fully booked.
        // Doing the grouping in memory if SQLite doesn't perfectly translate Sum inside Where grouping
        var orders = await _context.Orders.Include(o => o.OrderItems).ToListAsync();
        
        var bookedDates = orders
            .GroupBy(o => o.FulfillmentDate.Date)
            .Where(g => g.Sum(o => o.OrderItems.Sum(oi => oi.Quantity)) >= 3)
            .Select(g => g.Key.ToString("yyyy-MM-dd"))
            .ToList();

        return Ok(bookedDates);
    }

    [HttpPost("place")]
    public async Task<IActionResult> PlaceOrder([FromBody] PlaceOrderDto dto)
    {
        // Resolve customer
        var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Email == dto.CustomerEmail);
        if (customer == null)
        {
            customer = new Customer { 
                FirstName = dto.CustomerName, 
                Email = dto.CustomerEmail, 
                PhoneNumber = dto.CustomerPhone,
                IsWhatsApp = dto.IsWhatsApp
            };
            _context.Customers.Add(customer);
        }
        else
        {
            customer.PhoneNumber = dto.CustomerPhone;
            customer.IsWhatsApp = dto.IsWhatsApp;
        }
        await _context.SaveChangesAsync();

        // Determine items: prefer Items list (cart), fall back to legacy single-item fields
        var itemsToProcess = dto.Items != null && dto.Items.Count > 0
            ? dto.Items
            : new List<CartItemDto> { new CartItemDto { CakeId = dto.CakeId, Quantity = dto.Quantity > 0 ? dto.Quantity : 1, CustomDescription = dto.CustomDescription } };

        var orderItems = new List<OrderItem>();
        decimal totalAmount = 0;
        var cakeNames = new List<string>();

        foreach (var item in itemsToProcess)
        {
            Cake cake;
            if (item.CakeId == 0 && !string.IsNullOrEmpty(item.CustomDescription))
            {
                cake = new Cake { Name = "Custom Cake Request", Description = item.CustomDescription, Price = 0, CategoryId = 1 };
                _context.Cakes.Add(cake);
                await _context.SaveChangesAsync();
            }
            else
            {
                cake = await _context.Cakes.FindAsync(item.CakeId);
                if (cake == null) return NotFound($"Cake {item.CakeId} not found.");
            }

            totalAmount += cake.Price * item.Quantity;
            cakeNames.Add(cake.Name == "Custom Cake Request" ? $"Custom: {item.CustomDescription}" : cake.Name);
            orderItems.Add(new OrderItem { CakeId = cake.Id, Quantity = item.Quantity, UnitPrice = cake.Price });
        }

        var order = new Order
        {
            CustomerId = customer.Id,
            FulfillmentDate = dto.FulfillmentDate,
            DeliveryMethod = dto.DeliveryMethod,
            DeliveryAddress = dto.DeliveryAddress,
            TotalAmount = totalAmount,
            Status = "Pending",
            OrderItems = orderItems
        };

        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        // WhatsApp notifications
        var adminPhone = "+260975586410";
        var itemsSummary = string.Join(", ", cakeNames);
        var adminMsg = $"[iCAKES] *New Order Alert!*\nOrder #{order.Id} placed by {customer.FirstName}.\nItems: {itemsSummary}\nDate Required: {order.FulfillmentDate.ToShortDateString()}\nMethod: {order.DeliveryMethod}";
        await _whatsapp.SendMessageAsync(adminPhone, adminMsg);

        if (customer.IsWhatsApp && !string.IsNullOrEmpty(customer.PhoneNumber))
        {
            var customerMsg = $"Hello {customer.FirstName}! 🎂\nThank you for ordering from iCakes & Cookies. Your order (#{order.Id}) for {itemsSummary} has been received and is Pending review.\nKeep track of your order status on our website using your Track ID: {order.Id}!";
            await _whatsapp.SendMessageAsync(customer.PhoneNumber, customerMsg);
        }

        return Ok(order);
    }
}
