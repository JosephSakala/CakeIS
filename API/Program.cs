using CakeIS.Api.Data;
using Microsoft.EntityFrameworkCore;

using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Inject WhatsApp Notification Subsystem
builder.Services.AddHttpClient<CakeIS.Api.Services.IWhatsAppService, CakeIS.Api.Services.TwilioWhatsAppService>();

builder.Services.AddDbContext<CakeDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy => policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
                        .AllowAnyMethod()
                        .AllowAnyHeader());
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseCors("AllowFrontend");

app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<CakeDbContext>();
    // Because the frontend defaults to CategoryId = 1, we must ensure it exists!
    if (!context.Categories.Any())
    {
        context.Categories.Add(new CakeIS.Api.Models.Category { Name = "Signature", Description = "Our signature cakes" });
        context.SaveChanges();
    }
}

app.Run();
