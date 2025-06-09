import { Env } from "env";
import { Component } from "obsidian";

export abstract class RecycleComponent extends Component {

	private internalRecycleComponent: Component | null = null;

	public override onload(): void {
		Env.log.d(`RecycleComponent:onload`);
		super.onload();
	}

	public override onunload(): void {
		Env.log.d(`RecycleComponent:onunload`);
		super.onunload();
		this.dispose();
	}

	public override addChild<T extends Component>(component: T): T {
		Env.assert(false);
		return super.addChild(component);
	}

  public override removeChild<T extends Component>(component: T): T {
  	Env.assert(false);
		return super.removeChild(component);
  }

	/**
		* The {@link recycleComponent} was loaded.
		* Create and add children here.
		*/
	protected onRecycled(component: Component): void {};

	/** The {@link recycleComponent} is about to unload. */
	protected onRecycling(): void {};

	protected get recycleComponent() {
		return this.internalRecycleComponent!;
	}

	public recycle(): void {
		this.dispose();
		this.create();
	}

	private create(): void {
		this.internalRecycleComponent = new Component();

		if (this.internalRecycleComponent) {
			this.internalRecycleComponent.load();
			this.onRecycled(this.internalRecycleComponent);
		}
	}

	private dispose(): void {
		if (this.internalRecycleComponent) {
			this.onRecycling();
			// Clears its internal list of children and deregisters all its resources. The component is disposed and should no longer be used.
			this.internalRecycleComponent.unload();
			this.internalRecycleComponent = null;
		}
	}
}
