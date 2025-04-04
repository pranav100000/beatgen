import { Action } from '../types';

/**
 * CompositeAction - Bundles multiple actions together as a single history entry
 * This action treats a group of separate operations as a single atomic unit,
 * allowing them to be undone/redone together with a single command.
 */
export class CompositeAction implements Action {
    readonly type = 'COMPOSITE_ACTION';
    
    // Custom label for identifying the composite action's purpose
    private label: string;
    
    constructor(
        private actions: Action[],
        label: string = 'Composite Action'
    ) {
        this.label = label;
    }

    async execute(): Promise<void> {
        console.log(`🔄 Execute ${this.label} (${this.actions.length} actions)`);
        
        // Execute all contained actions in sequence
        for (const action of this.actions) {
            await action.execute();
        }
        
        console.log(`🔄 Completed ${this.label}`);
    }

    async undo(): Promise<void> {
        console.log(`↩️ Undo ${this.label} (${this.actions.length} actions)`);
        
        // Undo all contained actions in reverse order
        for (const action of this.actions.slice().reverse()) {
            await action.undo();
        }
        
        console.log(`↩️ Completed undoing ${this.label}`);
    }
}