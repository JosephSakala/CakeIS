using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CakeIS.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminResponseOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdminResponse",
                table: "Orders",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdminResponse",
                table: "Orders");
        }
    }
}
