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

// Inject Email Service
builder.Services.AddSingleton<CakeIS.Api.Services.IEmailService, CakeIS.Api.Services.GmailEmailService>();

// --- SQLite path: use /data/cake_is.db in production (persistent volume), else local file ---
var dataDir = Environment.GetEnvironmentVariable("DATA_DIR") ?? Directory.GetCurrentDirectory();
var dbPath = Path.Combine(dataDir, "cake_is.db");
builder.Services.AddDbContext<CakeDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

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

// --- CORS: allow localhost in dev + Vercel URL(s) from env var in production ---
var allowedOriginsEnv = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS") ?? "";
var allowedOrigins = allowedOriginsEnv
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Concat(new[] {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    })
    .Distinct()
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy => policy.WithOrigins(allowedOrigins)
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

// Only redirect to HTTPS locally — Railway handles TLS at the edge
if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Ensure image directory exists on the persistent volume
var imagesDir = Path.Combine(dataDir, "images");
Directory.CreateDirectory(imagesDir);

// Serve static files from the persistent data directory (for uploaded images)
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(imagesDir),
    RequestPath = "/images"
});

// Also serve from wwwroot for any bundled static assets
app.UseStaticFiles();

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Auto-migrate and seed on startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<CakeDbContext>();
    context.Database.Migrate();

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
