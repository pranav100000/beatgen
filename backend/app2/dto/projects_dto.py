from typing import Generic, TypeVar, List
from pydantic import BaseModel, Field

T = TypeVar("T")


class PageParams(BaseModel):
    page: int = Field(1, ge=1, description="Page number, 1-indexed")
    size: int = Field(10, ge=1, le=100, description="Page size")


class Page(BaseModel, Generic[T]):
    items: List[T]
    total_items: int
    page: int
    size: int
    total_pages: int

    @classmethod
    def create(cls, items: List[T], total_items: int, params: PageParams) -> "Page[T]":
        return cls(
            items=items,
            total_items=total_items,
            page=params.page,
            size=params.size,
            total_pages=(total_items + params.size - 1) // params.size
            if total_items > 0
            else 1,
        )
