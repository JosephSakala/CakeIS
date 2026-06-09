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
        string apiBaseUrl)
    {
        var senderEmail = _config["Gmail:SenderEmail"] ?? "joesaka19@gmail.com";
        var senderName  = _config["Gmail:SenderName"]  ?? "iCakes & Cookies";
        var appPassword = _config["Gmail:AppPassword"]  ?? "";

        if (string.IsNullOrEmpty(appPassword)) return; // Skip silently if not configured

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(senderName, senderEmail));
        message.To.Add(new MailboxAddress(customerName, toEmail));
        message.Subject = $"🎂 Order Confirmed! Your Order #{orderId} - iCakes & Cookies";

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
                  <div style=""display:inline-block;background:linear-gradient(135deg,#25D366,#128C7E);border-radius:50%;width:60px;height:60px;line-height:60px;font-size:1.8rem;margin-bottom:16px;"">✅</div>
                  <h2 style=""margin:0 0 8px;color:#2d1b00;font-size:1.5rem;"">Order Confirmed!</h2>
                  <p style=""margin:0;color:#8c6a3f;font-size:0.95rem;"">Hi <strong>{customerName}</strong>, your order has been received and is being reviewed.</p>
                </div>

                <!-- Order ID Pill -->
                <div style=""background:linear-gradient(135deg,#2d1b00,#5c3510);border-radius:12px;padding:16px 24px;text-align:center;margin-bottom:24px;"">
                  <div style=""color:#d4b896;font-size:0.8rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;"">Your Order ID</div>
                  <div style=""color:#c99c6e;font-size:2rem;font-weight:800;"">#{orderId}</div>
                  <div style=""color:#8c6a3f;font-size:0.8rem;margin-top:4px;"">Use this to track your order on our website</div>
                </div>

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

          <!-- Payment Details -->
          <tr>
            <td style=""padding:20px 0 0;"">
              <div style=""background:#ffffff;border-radius:16px;padding:28px 32px;box-shadow:0 2px 20px rgba(201,156,110,0.12);border:1px solid #f0e8dc;"">
                <h3 style=""margin:0 0 16px;color:#2d1b00;font-size:1rem;text-transform:uppercase;letter-spacing:1px;"">💳 Payment Instructions</h3>
                <p style=""margin:0 0 16px;color:#8c6a3f;font-size:0.9rem;"">Please complete your payment via <strong>Airtel Money</strong> using the details below:</p>

                <div style=""background:linear-gradient(135deg,#e8003a08,#e8003a12);border:2px solid #e8003a30;border-radius:12px;padding:20px 24px;"">
                  <table cellpadding=""0"" cellspacing=""0"" style=""width:100%;"">
                    <tr>
                      <td style=""padding:6px 0;"">
                        <span style=""color:#8c6a3f;font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;"">Network</span>
                        <div style=""color:#2d1b00;font-weight:700;font-size:1.05rem;margin-top:2px;"">📱 Airtel Money</div>
                      </td>
                    </tr>
                    <tr>
                      <td style=""padding:6px 0;border-top:1px solid #e8003a20;"">
                        <span style=""color:#8c6a3f;font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;"">Account Name</span>
                        <div style=""color:#2d1b00;font-weight:700;font-size:1.05rem;margin-top:2px;"">Mwangala Lutango</div>
                      </td>
                    </tr>
                    <tr>
                      <td style=""padding:6px 0;border-top:1px solid #e8003a20;"">
                        <span style=""color:#8c6a3f;font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;"">Number</span>
                        <div style=""color:#2d1b00;font-weight:800;font-size:1.4rem;letter-spacing:2px;margin-top:2px;"">0975 586 410</div>
                      </td>
                    </tr>
                    <tr>
                      <td style=""padding:6px 0;border-top:1px solid #e8003a20;"">
                        <span style=""color:#8c6a3f;font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;"">Amount to Send</span>
                        <div style=""color:#e8003a;font-weight:800;font-size:1.4rem;margin-top:2px;"">K{totalAmount:F2}</div>
                      </td>
                    </tr>
                  </table>
                </div>

                <p style=""margin:16px 0 0;color:#8c6a3f;font-size:0.85rem;text-align:center;"">
                  ⚠️ Please send your payment reference to us via WhatsApp at <strong>0975 586 410</strong> after paying.
                </p>
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
