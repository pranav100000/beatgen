import sys
import os
import json

# Add the current directory to the path so we can import app modules
sys.path.insert(0, os.path.abspath("."))

from app.utils.sse import format_sse_message

# Test the SSE message formatter
print("Testing SSE message formatter...")
test_message = format_sse_message("test", {"hello": "world"})
print(f"Message:\n{test_message}")

# Test JSON serialization
print("\nTesting JSON serialization...")
data = {"name": "Test", "values": [1, 2, 3]}
json_str = json.dumps(data)
print(f"JSON string: {json_str}")

print("\nAll tests completed successfully.")
