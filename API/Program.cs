using CakeIS.Api.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
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

// --- JWT Authentication ---
var jwtKey    = builder.Configuration["JwtSettings:Key"]!;
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"]!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = jwtIssuer,
            ValidAudience            = jwtIssuer,
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy => policy.WithOrigins(
                            "http://localhost:5173",
                            "http://127.0.0.1:5173",
                            "http://localhost:5174",
                            "http://127.0.0.1:5174")
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

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<CakeDbContext>();
    if (!context.Categories.Any())
    {
        context.Categories.Add(new CakeIS.Api.Models.Category { Name = "Cakes", Description = "Our signature cakes" });
        context.Categories.Add(new CakeIS.Api.Models.Category { Name = "Cookies", Description = "Our delicious cookies" });
        context.SaveChanges();
    }
    else
    {
        var firstCat = context.Categories.OrderBy(c => c.Id).FirstOrDefault();
        if (firstCat != null && firstCat.Name == "Signature")
        {
            firstCat.Name = "Cakes";
        }
        var cookiesCat = context.Categories.FirstOrDefault(c => c.Name == "Cookies");
        if (cookiesCat == null)
        {
            context.Categories.Add(new CakeIS.Api.Models.Category { Name = "Cookies", Description = "Our delicious cookies" });
        }
        context.SaveChanges();
    }
}

app.Run();
