using System;
using System.Collections.Generic;

namespace CakeIS.Api.Models;

public class Order
{
    public int Id { get; set; }
    public DateTime OrderDate { get; set; } = DateTime.UtcNow;
    public decimal TotalAmount { get; set; }
    
    // Status can be: Order Received, Baking, Completed, Cancelled
    public string Status { get; set; } = "Order Received";
    public string? AdminResponse { get; set; }
    
    public DateTime FulfillmentDate { get; set; } = DateTime.UtcNow.AddDays(1);
    public string DeliveryMethod { get; set; } = "Collection"; // "Collection" or "Delivery"
    public string? DeliveryAddress { get; set; }
    
    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }
    
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
