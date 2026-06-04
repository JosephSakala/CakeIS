using CakeIS.Api.Data;
using CakeIS.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace CakeIS.Api.Controllers;

public class PlaceOrderDto
{
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public bool IsWhatsApp { get; set; }
    
    public int CakeId { get; set; }
    public string? CustomDescription { get; set; }
    public int Quantity { get; set; }
    
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

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateStatusDto dto)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound("Order not found.");

        order.Status = dto.Status;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    public class UpdateResponseDto
    {
        public string Response { get; set; } = string.Empty;
    }

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
        Cake cake;
        if (dto.CakeId == 0 && !string.IsNullOrEmpty(dto.CustomDescription))
        {
             // Create a special hidden cake entry for this custom order, so it works with all existing relational logic
             cake = new Cake { Name = "Custom Cake Request", Description = dto.CustomDescription, Price = 0, CategoryId = 1 };
             _context.Cakes.Add(cake);
             await _context.SaveChangesAsync();
        }
        else
        {
            cake = await _context.Cakes.FindAsync(dto.CakeId);
            if (cake == null) return NotFound("Cake not found");
        }

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

        var order = new Order
        {
            CustomerId = customer.Id,
            FulfillmentDate = dto.FulfillmentDate,
            DeliveryMethod = dto.DeliveryMethod,
            DeliveryAddress = dto.DeliveryAddress,
            TotalAmount = cake.Price * dto.Quantity,
            Status = "Pending",
            OrderItems = new List<OrderItem>
            {
                new OrderItem
                {
                    CakeId = cake.Id,
                    Quantity = dto.Quantity,
                    UnitPrice = cake.Price
                }
            }
        };

        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        // ---------------- WHATSAPP DISPATCH SUBSYSTEM ----------------
        var adminPhone = "+260975586410"; // Hardcoded Admin Number for dispatch
        var cakeName = cake.Name == "Custom Cake Request" ? $"Custom Cake: {dto.CustomDescription}" : cake.Name;
        
        var adminMsg = $"[iCAKES] *New Order Alert!*\nOrder #{order.Id} placed by {customer.FirstName}.\nItem: {cakeName}\nDate Required: {order.FulfillmentDate.ToShortDateString()}\nMethod: {order.DeliveryMethod}";
        await _whatsapp.SendMessageAsync(adminPhone, adminMsg);

        if (customer.IsWhatsApp && !string.IsNullOrEmpty(customer.PhoneNumber))
        {
            var customerMsg = $"Hello {customer.FirstName}! 🎂\nThank you for ordering from iCakes & Cookies. Your order (#{order.Id}) for a {cakeName} has been received and is Pending review.\nKeep track of your order status on our website using your Track ID: {order.Id}!";
            await _whatsapp.SendMessageAsync(customer.PhoneNumber, customerMsg);
        }

        return Ok(order);
    }
}
