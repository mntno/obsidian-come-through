
export function forEachWithLabel<T extends string>(
	values: readonly T[],
	getLabel: (value: T) => string,
	callback: (value: T, label: string) => void,
): void {
	for (const value of values) {
		callback(value, getLabel(value));
	}
}
