using System.Collections.Generic;

namespace CakeIS.Api.Models;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    
    public ICollection<Cake> Cakes { get; set; } = new List<Cake>();
}
