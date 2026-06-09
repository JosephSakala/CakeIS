using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace CakeIS.Api.Services;

public class GmailEmailService : IEmailService
{
    private readonly IConfiguration _config;

    public GmailEmailService(IConfiguration config)
    {
        _config = config;
    }

    public async Task SendOrderConfirmationAsync(
        string toEmail,
        string customerName,
        int orderId,
        List<OrderEmailItem> items,
        decimal totalAmount,
        DateTime fulfillmentDate,
        string deliveryMethod,
        string? deliveryAddress,
        string apiBaseUrl,
        bool isPaid = false)
    {
        var senderEmail = _config["Gmail:SenderEmail"] ?? "joesaka19@gmail.com";
        var senderName  = _config["Gmail:SenderName"]  ?? "iCakes & Cookies";
        var appPassword = _config["Gmail:AppPassword"]  ?? "";

        if (string.IsNullOrEmpty(appPassword)) return; // Skip silently if not configured

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(senderName, senderEmail));
        message.To.Add(new MailboxAddress(customerName, toEmail));
        message.Subject = isPaid 
            ? $"Payment Received & Order Confirmed! (#{orderId}) - iCakes and Cookies" 
            : $"Order #{orderId} Received (Awaiting Payment) - iCakes and Cookies";

        // Build items HTML rows
        var itemsHtml = string.Join("", items.Select(item =>
        {
            var imgSrc = !string.IsNullOrEmpty(item.ImageUrl)
                ? $"{apiBaseUrl}{item.ImageUrl}"
                : "";

            var imgHtml = !string.IsNullOrEmpty(imgSrc)
                ? $@"<img src=""{imgSrc}"" alt=""{item.Name}"" style=""width:80px;height:80px;object-fit:cover;border-radius:10px;display:block;""/>"
                : $@"<div style=""width:80px;height:80px;background:linear-gradient(135deg,#c99c6e,#e8c49a);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:2rem;"">🎂</div>";

            return $@"
            <tr>
              <td style=""padding:16px 0;border-bottom:1px solid #f0ebe4;"">
                <table cellpadding=""0"" cellspacing=""0"" style=""width:100%;"">
                  <tr>
                    <td style=""width:90px;vertical-align:middle;padding-right:16px;"">
                      {imgHtml}
                    </td>
                    <td style=""vertical-align:middle;"">
                      <div style=""font-weight:700;font-size:1rem;color:#2d1b00;margin-bottom:4px;"">{item.Name}</div>
                      <div style=""color:#8c6a3f;font-size:0.9rem;"">Qty: {item.Quantity} &nbsp;×&nbsp; K{item.UnitPrice:F2}</div>
                    </td>
                    <td style=""vertical-align:middle;text-align:right;"">
                      <div style=""font-weight:700;font-size:1rem;color:#c99c6e;"">K{(item.UnitPrice * item.Quantity):F2}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>";
        }));

        var deliveryHtml = deliveryMethod == "Home Delivery" && !string.IsNullOrEmpty(deliveryAddress)
            ? $"Home Delivery to: <strong>{deliveryAddress}</strong>"
            : "Collection (Pick up from us)";

        var paymentInstructionsHtml = !isPaid ? $@"
                <div style=""background:#fdf8f3;border:1px dashed #c99c6e;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;"">
                  <h3 style=""margin:0 0 12px;color:#2d1b00;font-size:1.1rem;"">Payment Instructions</h3>
                  <p style=""margin:0 0 8px;color:#8c6a3f;font-size:0.95rem;"">Please pay <strong>K{totalAmount:F2}</strong> via Mobile Money to:</p>
                  <div style=""font-size:1.2rem;font-weight:700;color:#2d1b00;letter-spacing:1px;"">0975586410</div>
                  <div style=""color:#c99c6e;font-size:0.9rem;margin-top:4px;font-weight:600;"">Name: Mwangala Lutangu</div>
                  <p style=""margin:12px 0 0;color:#8c6a3f;font-size:0.85rem;"">Once you've made the payment, please send us a screenshot/receipt on WhatsApp to confirm your order.</p>
                </div>" : "";

        var html = $@"
<!DOCTYPE html>
<html>
<head>
  <meta charset=""UTF-8""/>
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0""/>
</head>
<body style=""margin:0;padding:0;background:#fdf8f3;font-family:'Segoe UI',Arial,sans-serif;"">

  <!-- Header -->
  <table width=""100%"" cellpadding=""0"" cellspacing=""0"">
    <tr>
      <td style=""background:linear-gradient(135deg,#2d1b00 0%,#5c3510 100%);padding:40px 20px;text-align:center;"">
        <div style=""font-size:2.5rem;margin-bottom:8px;"">🎂</div>
        <h1 style=""margin:0;color:#c99c6e;font-size:1.8rem;font-weight:800;letter-spacing:-0.5px;"">iCakes <span style=""color:#ffffff;"">&amp; Cookies</span></h1>
        <p style=""margin:8px 0 0;color:#d4b896;font-size:0.95rem;"">Handcrafted with love, delivered with care</p>
      </td>
    </tr>
  </table>

  <!-- Body -->
  <table width=""100%"" cellpadding=""0"" cellspacing=""0"">
    <tr>
      <td style=""padding:0 20px 40px;"">
        <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""max-width:600px;margin:0 auto;"">

          <!-- Confirmation Banner -->
          <tr>
            <td style=""padding:32px 0 0;"">
              <div style=""background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 20px rgba(201,156,110,0.12);border:1px solid #f0e8dc;"">
                <div style=""text-align:center;margin-bottom:24px;"">
                  <div style=""display:inline-block;background:linear-gradient(135deg,{(isPaid ? "#25D366,#128C7E" : "#f5a623,#f07e00")});border-radius:50%;width:60px;height:60px;line-height:60px;font-size:1.8rem;margin-bottom:16px;"">{(isPaid ? "✅" : "⏳")}</div>
                  <h2 style=""margin:0 0 8px;color:#2d1b00;font-size:1.5rem;"">{(isPaid ? "Payment Received &amp; Order Confirmed!" : "Order Received - Awaiting Payment")}</h2>
                  <p style=""margin:0;color:#8c6a3f;font-size:0.95rem;"">
                    Hi <strong>{customerName}</strong>, 
                    {(isPaid ? "your payment has been received and your order is now confirmed and in progress." : "we have received your order! To confirm it, please make a payment using the details below.")}
                  </p>
                </div>

                <!-- Order ID Pill -->
                <div style=""background:linear-gradient(135deg,#2d1b00,#5c3510);border-radius:12px;padding:16px 24px;text-align:center;margin-bottom:24px;"">
                  <div style=""color:#d4b896;font-size:0.8rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;"">Your Order ID</div>
                  <div style=""color:#c99c6e;font-size:2rem;font-weight:800;"">#{orderId}</div>
                  <div style=""color:#8c6a3f;font-size:0.8rem;margin-top:4px;"">Use this to track your order on our website</div>
                </div>

                {paymentInstructionsHtml}

                <!-- Order Details -->
                <table cellpadding=""0"" cellspacing=""0"" style=""width:100%;margin-bottom:24px;"">
                  <tr>
                    <td style=""padding:8px 12px;background:#fdf8f3;border-radius:8px 8px 0 0;border-bottom:1px solid #f0e8dc;"">
                      <span style=""color:#8c6a3f;font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;"">📅 Fulfillment Date</span>
                      <div style=""color:#2d1b00;font-weight:600;margin-top:2px;"">{fulfillmentDate:dddd, MMMM dd yyyy}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style=""padding:8px 12px;background:#fdf8f3;border-radius:0 0 8px 8px;"">
                      <span style=""color:#8c6a3f;font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;"">🚚 Delivery Method</span>
                      <div style=""color:#2d1b00;font-weight:600;margin-top:2px;"">{deliveryHtml}</div>
                    </td>
                  </tr>
                </table>

                <!-- Items -->
                <h3 style=""margin:0 0 8px;color:#2d1b00;font-size:1rem;text-transform:uppercase;letter-spacing:1px;"">🛒 Your Items</h3>
                <table cellpadding=""0"" cellspacing=""0"" style=""width:100%;"">
                  {itemsHtml}
                </table>

                <!-- Total -->
                <div style=""background:linear-gradient(135deg,#c99c6e,#e8c49a);border-radius:10px;padding:16px 20px;margin-top:16px;display:flex;justify-content:space-between;align-items:center;"">
                  <table width=""100%"" cellpadding=""0"" cellspacing=""0"">
                    <tr>
                      <td style=""color:#2d1b00;font-weight:700;font-size:1.05rem;"">Total Amount</td>
                      <td style=""text-align:right;color:#2d1b00;font-weight:800;font-size:1.3rem;"">K{totalAmount:F2}</td>
                    </tr>
                  </table>
                </div>
              </div>
            </td>
          </tr>


          <!-- Footer -->
          <tr>
            <td style=""padding:24px 0;text-align:center;"">
              <p style=""margin:0 0 8px;color:#8c6a3f;font-size:0.85rem;"">Questions? Contact us on WhatsApp:</p>
              <a href=""https://wa.me/260975586410"" style=""display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:700;font-size:0.9rem;"">💬 Chat on WhatsApp</a>
              <p style=""margin:20px 0 0;color:#c4aa8e;font-size:0.75rem;"">© {DateTime.Now.Year} iCakes &amp; Cookies. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>";

        var bodyBuilder = new BodyBuilder { HtmlBody = html };
        message.Body = bodyBuilder.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync("smtp.gmail.com", 587, SecureSocketOptions.StartTls);
        await client.AuthenticateAsync(senderEmail, appPassword);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }

    public async Task SendBakingStartedAsync(string toEmail, string customerName, int orderId)
    {
        var senderEmail = _config["Gmail:SenderEmail"] ?? "joesaka19@gmail.com";
        var senderName  = _config["Gmail:SenderName"]  ?? "iCakes & Cookies";
        var appPassword = _config["Gmail:AppPassword"]  ?? "";

        if (string.IsNullOrEmpty(appPassword)) return;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(senderName, senderEmail));
        message.To.Add(new MailboxAddress(customerName, toEmail));
        message.Subject = $"Baking Started! (#{orderId}) - iCakes and Cookies";

        var html = $@"
<!DOCTYPE html>
<html>
<head>
  <meta charset=""UTF-8""/>
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0""/>
</head>
<body style=""margin:0;padding:0;background:#fdf8f3;font-family:'Segoe UI',Arial,sans-serif;"">

  <!-- Header -->
  <table width=""100%"" cellpadding=""0"" cellspacing=""0"">
    <tr>
      <td style=""background:linear-gradient(135deg,#2d1b00 0%,#5c3510 100%);padding:40px 20px;text-align:center;"">
        <div style=""font-size:2.5rem;margin-bottom:8px;"">🎂</div>
        <h1 style=""margin:0;color:#c99c6e;font-size:1.8rem;font-weight:800;letter-spacing:-0.5px;"">iCakes <span style=""color:#ffffff;"">&amp; Cookies</span></h1>
      </td>
    </tr>
  </table>

  <!-- Body -->
  <table width=""100%"" cellpadding=""0"" cellspacing=""0"">
    <tr>
      <td style=""padding:0 20px 40px;"">
        <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""max-width:600px;margin:0 auto;"">
          <tr>
            <td style=""padding:32px 0 0;"">
              <div style=""background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 20px rgba(201,156,110,0.12);border:1px solid #f0e8dc;"">
                <div style=""text-align:center;margin-bottom:24px;"">
                  <div style=""display:inline-block;background:linear-gradient(135deg,#e8c49a,#c99c6e);border-radius:50%;width:60px;height:60px;line-height:60px;font-size:1.8rem;margin-bottom:16px;"">👨‍🍳</div>
                  <h2 style=""margin:0 0 8px;color:#2d1b00;font-size:1.5rem;"">Baking has Started!</h2>
                  <p style=""margin:0;color:#8c6a3f;font-size:0.95rem;"">Hi <strong>{customerName}</strong>, great news! We have started baking your order (#{orderId}). We'll let you know once it's ready.</p>
                </div>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style=""padding:24px 0;text-align:center;"">
              <p style=""margin:0 0 8px;color:#8c6a3f;font-size:0.85rem;"">Questions? Contact us on WhatsApp:</p>
              <a href=""https://wa.me/260975586410"" style=""display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:700;font-size:0.9rem;"">💬 Chat on WhatsApp</a>
              <p style=""margin:20px 0 0;color:#c4aa8e;font-size:0.75rem;"">© {DateTime.Now.Year} iCakes &amp; Cookies. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";

        var bodyBuilder = new BodyBuilder { HtmlBody = html };
        message.Body = bodyBuilder.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync("smtp.gmail.com", 587, SecureSocketOptions.StartTls);
        await client.AuthenticateAsync(senderEmail, appPassword);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}
