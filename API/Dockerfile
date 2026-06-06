# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["CakeIS.Api.csproj", "./"]
RUN dotnet restore "./CakeIS.Api.csproj"

COPY . .
RUN dotnet publish "CakeIS.Api.csproj" -c Release -o /app/publish

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

COPY --from=build /app/publish .

# Create data directory for SQLite DB + images
RUN mkdir -p /data/images

EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "CakeIS.Api.dll"]
