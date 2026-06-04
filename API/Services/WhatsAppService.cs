using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CakeIS.Api.Services
{
    public interface IWhatsAppService
    {
        Task SendMessageAsync(string toPhoneNumber, string message);
    }

    public class TwilioWhatsAppService : IWhatsAppService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _config;
        private readonly ILogger<TwilioWhatsAppService> _logger;

        public TwilioWhatsAppService(HttpClient httpClient, IConfiguration config, ILogger<TwilioWhatsAppService> logger)
        {
            _httpClient = httpClient;
            _config = config;
            _logger = logger;
        }

        public async Task SendMessageAsync(string toPhoneNumber, string message)
        {
            var accountSid = _config["Twilio_WhatsApp:AccountSid"];
            var authToken = _config["Twilio_WhatsApp:AuthToken"];
            var fromNumber = _config["Twilio_WhatsApp:FromNumber"];

            if (string.IsNullOrEmpty(accountSid) || accountSid == "INSERT_YOUR_TWILIO_SID_HERE")
            {
                _logger.LogWarning($"[MOCK WHATSAPP QUEUE] Message to {toPhoneNumber}: {message}");
                return;
            }

            var url = $"https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Messages.json";
            
            if (!toPhoneNumber.StartsWith("whatsapp:"))
            {
               toPhoneNumber = "whatsapp:" + (toPhoneNumber.StartsWith("+") ? toPhoneNumber : "+" + toPhoneNumber);
            }

            var requestContent = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("To", toPhoneNumber),
                new KeyValuePair<string, string>("From", fromNumber),
                new KeyValuePair<string, string>("Body", message)
            });

            _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Basic", Convert.ToBase64String(Encoding.ASCII.GetBytes($"{accountSid}:{authToken}")));

            var response = await _httpClient.PostAsync(url, requestContent);
            if (!response.IsSuccessStatusCode)
            {
                var errorResult = await response.Content.ReadAsStringAsync();
                _logger.LogError($"WhatsApp dispatch failed: {errorResult}");
            }
            else
            {
                _logger.LogInformation($"WhatsApp message successfully fired to {toPhoneNumber}!!");
            }
        }
    }
}
