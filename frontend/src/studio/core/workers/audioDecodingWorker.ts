// frontend/src/studio/core/workers/audioDecodingWorker.ts

// Define types for messages for clarity
interface DecodeRequest {
  id: string; // Unique ID to correlate requests and responses
  buffer: ArrayBuffer;
}

// Worker now sends back the buffer directly
interface BufferResponse {
  id: string;
  type: 'buffer'; // Indicate it's the buffer being returned
  buffer: ArrayBuffer;
}

interface WorkerErrorResponse {
  id: string;
  type: 'error';
  message: string;
}

// No AudioContext needed here anymore

self.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const { id, buffer } = event.data;

  if (!buffer) {
    const errorResponse: WorkerErrorResponse = {
      id: id,
      type: 'error',
      message: 'No ArrayBuffer received in worker.',
    };
    self.postMessage(errorResponse);
    return;
  }

  try {
    // Simply send the buffer back to the main thread for decoding
    console.log(`[Worker ${id}] Received buffer (${(buffer.byteLength / 1024).toFixed(2)} KB), sending back to main thread.`);
    const response: BufferResponse = {
      id: id,
      type: 'buffer',
      buffer: buffer,
    };
    // Transfer the buffer back
    self.postMessage(response, { transfer: [buffer] });

  } catch (error: any) {
    // Catch potential errors during message posting/transfer
    console.error(`[Worker ${id}] Error processing/sending buffer:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown worker error';
    const errorResponse: WorkerErrorResponse = {
      id: id,
      type: 'error',
      message: errorMessage,
    };
    self.postMessage(errorResponse);
  }
};

console.log('[AudioDecodingWorker] Worker initialized (buffer pass-through mode).'); 