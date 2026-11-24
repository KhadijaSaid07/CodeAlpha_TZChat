from django.contrib import admin

from .models import AuditLog, Report, SystemSetting


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("id", "reporter", "reason", "status", "reviewed_by", "created_at")
    list_filter = ("status",)
    search_fields = ("reporter__username", "reason")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "actor", "action", "target_type", "target_id", "result", "created_at")
    list_filter = ("result", "action")
    readonly_fields = ("actor", "action", "target_type", "target_id", "result", "metadata", "ip_address", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(SystemSetting)
