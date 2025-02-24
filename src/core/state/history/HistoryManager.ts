import { Action } from './types';

export class HistoryManager {
  private undoStack: Action[] = [];
  private redoStack: Action[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    console.log('📝 History Manager initialized');
  }

  subscribe(listener: () => void): void {
    this.listeners.add(listener);
  }

  unsubscribe(listener: () => void): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  async executeAction(action: Action): Promise<void> {
    await action.execute();
    this.undoStack.push(action);
    this.redoStack = []; // Clear redo stack when new action is executed
    this.logState();
    this.notifyListeners();
  }

  async undo(): Promise<void> {
    const action = this.undoStack.pop();
    if (action) {
      await action.undo();
      this.redoStack.push(action);
      this.logState();
      this.notifyListeners();
    }
  }

  async redo(): Promise<void> {
    const action = this.redoStack.pop();
    if (action) {
      await action.execute();
      this.undoStack.push(action);
      this.logState();
      this.notifyListeners();
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private logState(): void {
    console.log('📝 History State:', {
      undoStack: this.undoStack.map(a => ({ type: a.type })),
      redoStack: this.redoStack.map(a => ({ type: a.type })),
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });
  }
}

// Export a singleton instance
export const historyManager = new HistoryManager(); 