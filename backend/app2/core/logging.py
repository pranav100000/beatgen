import logging
import sys
from typing import Any, Dict, Optional

class LoggerFactory:
    """Centralized logger creation to ensure consistent configuration"""
    
    @staticmethod
    def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
        """
        Get a configured logger instance by name
        
        Args:
            name: The name of the logger
            level: The logging level (default: INFO)
            
        Returns:
            A configured logger instance
        """
        logger = logging.getLogger(name)
        logger.setLevel(level)
        
        # Avoid adding handlers if they already exist
        if not logger.hasHandlers():
            # Console handler with formatting
            console_handler = logging.StreamHandler(sys.stdout)
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s [%(filename)s:%(lineno)d] - %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S"
            )
            console_handler.setFormatter(formatter)
            logger.addHandler(console_handler)
            
        return logger
        
    @staticmethod
    def get_service_logger(service_name: str) -> logging.Logger:
        """
        Get a logger specifically for services
        
        Args:
            service_name: The name of the service
            
        Returns:
            A configured logger for the service
        """
        return LoggerFactory.get_logger(f"beatgen.services.{service_name}")
        
    @staticmethod
    def get_repository_logger(repo_name: str) -> logging.Logger:
        """
        Get a logger specifically for repositories
        
        Args:
            repo_name: The name of the repository
            
        Returns:
            A configured logger for the repository
        """
        return LoggerFactory.get_logger(f"beatgen.repositories.{repo_name}")

    @staticmethod
    def get_api_logger(route_name: str) -> logging.Logger:
        """
        Get a logger specifically for API routes
        
        Args:
            route_name: The name of the route
            
        Returns:
            A configured logger for the API route
        """
        return LoggerFactory.get_logger(f"beatgen.api.{route_name}")

# Convenience functions
def get_logger(name: str) -> logging.Logger:
    """Get a configured logger instance"""
    return LoggerFactory.get_logger(name)

def get_service_logger(service_name: str) -> logging.Logger:
    """Get a service-specific logger"""
    return LoggerFactory.get_service_logger(service_name)

def get_repository_logger(repo_name: str) -> logging.Logger:
    """Get a repository-specific logger"""
    return LoggerFactory.get_repository_logger(repo_name)

def get_api_logger(route_name: str) -> logging.Logger:
    """Get an API route-specific logger"""
    return LoggerFactory.get_api_logger(route_name)