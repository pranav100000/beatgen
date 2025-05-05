from dataclasses import dataclass


@dataclass
class SSEEvent:
    event: str
    data: dict
    id: str
    retry: int
