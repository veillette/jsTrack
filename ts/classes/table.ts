/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 */

import type { Track } from './track';

interface ColumnSetting {
	title: string;
	type: string;
}

export interface TableColumns {
	[key: string]: string;
}

export type TableRowData = Record<string, number | string | null>;

export class Table {
	track: Track;
	columns: TableColumns;
	data: TableRowData[];
	tableData: Array<Array<number | string | null>>;
	settings: { columns: ColumnSetting[] };

	constructor(track: Track, columns: TableColumns) {
		this.track = track;
		this.columns = columns;
		this.data = [];
		this.tableData = [];
		const columnArray: ColumnSetting[] = [];
		for (const title in columns) {
			columnArray.push({
				title: `${title}(${columns[title]})`,
				type: 'text',
			});
		}
		this.settings = {
			columns: columnArray,
		};
	}

	makeActive(): void {
		const settings = this.settings;
		const data = this.tableData;
		this.track.project.handsOnTable.updateSettings(settings);
		if (data.length > 0) this.track.project.handsOnTable.loadData(data);
		else this.track.project.handsOnTable.loadData([null]);
	}

	newCols(columns: TableColumns): void {
		this.columns = columns;
		const columnArray: ColumnSetting[] = [];
		for (const title in columns) {
			columnArray.push({
				title: `${title}(${columns[title]})`,
				type: 'text',
			});
		}
		this.settings.columns = columnArray;
		this.track.project.handsOnTable.updateSettings(this.settings);
	}

	newData(data: TableRowData[], update = true, replace = true): void {
		if (replace) {
			this.tableData = [];
			this.data = [];
		}
		for (let i = 0; i < data.length; i++) {
			const tempRow: Array<number | string | null> = [];
			for (const column in this.columns) {
				if (data[i][column] !== undefined) {
					tempRow.push(data[i][column]);
				} else {
					tempRow.push(null);
				}
			}
			this.tableData.push(tempRow);
			this.data.push(data[i]);
		}
		this.sort();

		if (replace) this.track.project.handsOnTable.updateSettings({ data: [] });
		if (update) this.track.project.handsOnTable.loadData(this.tableData);
	}

	addColumn(newColumns: TableColumns): void {
		for (const title in newColumns) {
			if (this.columns[title] === undefined) {
				this.columns[title] = newColumns[title];

				const tempData: Array<Array<number | string | null>> = [];
				for (let i = 0; i < this.data.length; i++) {
					const tempRow: Array<number | string | null> = [];
					for (const column in this.columns) {
						if (this.data[i][column] !== undefined) {
							tempRow.push(this.data[i][column]);
						} else {
							tempRow.push(null);
						}
					}
					tempData.push(tempRow);
				}
				this.tableData = tempData;
				this.sort();

				this.settings.columns.push({
					title: `${title}(${newColumns[title]})`,
					type: 'text',
				});
				this.makeActive();
			}
		}
	}

	addRow(row: TableRowData, update = false): void {
		const tempRow: Array<number | string | null> = [];
		for (const column in this.columns) {
			if (row[column] !== undefined) {
				tempRow.push(row[column]);
			} else {
				tempRow.push(null);
			}
		}
		this.data.push(row);
		this.tableData.push(tempRow);
		this.sort();

		if (update) this.track.project.handsOnTable.loadData(this.tableData);
	}

	sort(index: number | string = 0): void {
		if (typeof index === 'number') {
			this.tableData.sort((a, b) => {
				const aVal = a[index];
				const bVal = b[index];
				if (aVal === null || bVal === null) return 0;
				if (aVal < bVal) return -1;
				else if (aVal > bVal) return 1;
				else return 0;
			});
		} else {
			this.data.sort((a, b) => {
				const aVal = a[index];
				const bVal = b[index];
				if (aVal == null || bVal == null) return 0;
				if (aVal < bVal) return -1;
				else if (aVal > bVal) return 1;
				else return 0;
			});
		}
	}
}
