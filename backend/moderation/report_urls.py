from django.urls import path

from .views import SubmitReportView

urlpatterns = [
    path("", SubmitReportView.as_view(), name="report-submit"),
]
