using Microsoft.EntityFrameworkCore;
using CakeIS.Api.Models;

namespace CakeIS.Api.Data;

public class CakeDbContext : DbContext
{
    public CakeDbContext(DbContextOptions<CakeDbContext> options) : base(options) { }

    public DbSet<Category> Categories { get; set; }
    public DbSet<Cake> Cakes { get; set; }
    public DbSet<Customer> Customers { get; set; }
    public DbSet<Order> Orders { get; set; }
    public DbSet<OrderItem> OrderItems { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // Define relations and precision constraints
        modelBuilder.Entity<Cake>()
            .Property(c => c.Price)
            .HasColumnType("decimal(18,2)");
            
        modelBuilder.Entity<Order>()
            .Property(o => o.TotalAmount)
            .HasColumnType("decimal(18,2)");
            
        modelBuilder.Entity<OrderItem>()
            .Property(oi => oi.UnitPrice)
            .HasColumnType("decimal(18,2)");
    }
}
