using CakeIS.Api.Data;
using CakeIS.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

namespace CakeIS.Api.Controllers;

public class CakeDto
{
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? Description { get; set; }
    public int CategoryId { get; set; }
    public IFormFile? Image { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class CakesController : ControllerBase
{
    private readonly CakeDbContext _context;

    public CakesController(CakeDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Cake>>> GetCakes()
    {
        return await _context.Cakes.Include(c => c.Category).Where(c => c.Name != "Custom Cake Request").ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Cake>> GetCake(int id)
    {
        var cake = await _context.Cakes.Include(c => c.Category).FirstOrDefaultAsync(c => c.Id == id);
        if (cake == null) return NotFound();
        return cake;
    }

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<Cake>> PostCake([FromForm] CakeDto dto)
    {
        var cake = new Cake
        {
            Name = dto.Name,
            Price = dto.Price,
            Description = dto.Description,
            CategoryId = dto.CategoryId
        };

        if (dto.Image != null)
        {
            var dataDir = Environment.GetEnvironmentVariable("DATA_DIR") ?? Directory.GetCurrentDirectory();
            var uploadsDir = Path.Combine(dataDir, "images");
            Directory.CreateDirectory(uploadsDir);
            
            var fileName = Guid.NewGuid().ToString() + Path.GetExtension(dto.Image.FileName);
            var filePath = Path.Combine(uploadsDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await dto.Image.CopyToAsync(stream);
            }

            cake.ImageUrl = $"/images/{fileName}";
        }

        _context.Cakes.Add(cake);
        await _context.SaveChangesAsync();
        
        return CreatedAtAction(nameof(GetCake), new { id = cake.Id }, cake);
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> PutCake(int id, [FromForm] CakeDto dto)
    {
        var cake = await _context.Cakes.FindAsync(id);
        if (cake == null) return NotFound();

        cake.Name = dto.Name;
        cake.Price = dto.Price;
        cake.Description = dto.Description;
        cake.CategoryId = dto.CategoryId;

        if (dto.Image != null)
        {
            var dataDir = Environment.GetEnvironmentVariable("DATA_DIR") ?? Directory.GetCurrentDirectory();
            var uploadsDir = Path.Combine(dataDir, "images");
            Directory.CreateDirectory(uploadsDir);
            var fileName = Guid.NewGuid().ToString() + Path.GetExtension(dto.Image.FileName);
            var filePath = Path.Combine(uploadsDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await dto.Image.CopyToAsync(stream);
            }
            cake.ImageUrl = $"/images/{fileName}";
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!_context.Cakes.Any(e => e.Id == id)) return NotFound();
            else throw;
        }

        return NoContent();
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCake(int id)
    {
        var cake = await _context.Cakes.FindAsync(id);
        if (cake == null) return NotFound();

        _context.Cakes.Remove(cake);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
