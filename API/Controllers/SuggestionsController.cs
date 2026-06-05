using CakeIS.Api.Data;
using CakeIS.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace CakeIS.Api.Controllers;

public class SuggestionDto
{
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public string Content { get; set; } = string.Empty;
}

[ApiController]
[Route("api/[controller]")]
public class SuggestionsController : ControllerBase
{
    private readonly CakeDbContext _context;

    public SuggestionsController(CakeDbContext context)
    {
        _context = context;
    }

    // POST: api/suggestions
    [HttpPost]
    public async Task<IActionResult> PostSuggestion([FromBody] SuggestionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.CustomerName) || string.IsNullOrWhiteSpace(dto.Content))
        {
            return BadRequest("Name and content are required fields.");
        }

        var suggestion = new Suggestion
        {
            CustomerName = dto.CustomerName.Trim(),
            CustomerEmail = dto.CustomerEmail?.Trim(),
            Content = dto.Content.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _context.Suggestions.Add(suggestion);
        await _context.SaveChangesAsync();

        return Ok(suggestion);
    }

    // GET: api/suggestions
    [Authorize]
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Suggestion>>> GetSuggestions()
    {
        return await _context.Suggestions
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();
    }

    // DELETE: api/suggestions/5
    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSuggestion(int id)
    {
        var suggestion = await _context.Suggestions.FindAsync(id);
        if (suggestion == null)
        {
            return NotFound("Suggestion not found.");
        }

        _context.Suggestions.Remove(suggestion);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
