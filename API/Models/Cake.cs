namespace CakeIS.Api.Models;

public class Cake
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
}
