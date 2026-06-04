using System.Collections.Generic;

namespace CakeIS.Api.Models;

public class Customer
{
    public int Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public bool IsWhatsApp { get; set; } = false;
    
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
