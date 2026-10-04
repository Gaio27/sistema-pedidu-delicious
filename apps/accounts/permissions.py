from functools import wraps
from django.core.exceptions import PermissionDenied
from django.shortcuts import redirect
from rest_framework.permissions import BasePermission
from .models import Role

def role_required(allowed_roles):
    """
    Decorator for views that checks whether a user has a particular role.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect('login')
            if request.user.is_superuser or request.user.role in allowed_roles:
                return view_func(request, *args, **kwargs)
            raise PermissionDenied("You do not have access to this resource.")
        return _wrapped_view
    return decorator

class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and
                    (request.user.is_superuser or request.user.is_admin))

class IsCashierRole(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_cashier)

class IsKitchenRole(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_kitchen)

class IsCashierOrAdmin(BasePermission):
    """Allow access to authenticated Cashier or Admin users."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and
            (request.user.is_superuser or request.user.is_cashier or request.user.is_admin)
        )

class IsKitchenOrAdmin(BasePermission):
    """Allow access to authenticated Kitchen staff or Admin users."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and
            (request.user.is_superuser or request.user.is_kitchen or request.user.is_admin)
        )
