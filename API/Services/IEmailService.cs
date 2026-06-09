namespace CakeIS.Api.Services;

public interface IEmailService
{
    Task SendOrderConfirmationAsync(
        string toEmail,
        string customerName,
        int orderId,
        List<OrderEmailItem> items,
        decimal totalAmount,
        DateTime fulfillmentDate,
        string deliveryMethod,
        string? deliveryAddress,
        string apiBaseUrl,
        bool isPaid = false
    );

    Task SendBakingStartedAsync(
        string toEmail,
        string customerName,
        int orderId
    );
}

public class OrderEmailItem
{
    public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public string? ImageUrl { get; set; }
}
