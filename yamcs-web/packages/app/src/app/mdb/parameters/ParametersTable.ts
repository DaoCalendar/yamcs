import { Component, ChangeDetectionStrategy, ViewChild, Input, AfterViewInit } from '@angular/core';

import { Parameter } from '@yamcs/client';

import { MatSort, MatTableDataSource, MatPaginator } from '@angular/material';
import { ColumnInfo } from '../../shared/template/ColumnChooser';

@Component({
  selector: 'app-parameters-table',
  templateUrl: './ParametersTable.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParametersTable implements AfterViewInit {

  @Input()
  instance: string;

  @Input()
  parameters$: Promise<Parameter[]>;

  @Input()
  shortName = false;

  @ViewChild(MatSort)
  sort: MatSort;

  @ViewChild(MatPaginator)
  paginator: MatPaginator;

  dataSource = new MatTableDataSource<Parameter>([]);

  columns: ColumnInfo[] = [
    { id: 'name', label: 'Name', alwaysVisible: true },
    { id: 'type', label: 'Type' },
    { id: 'units', label: 'Units' },
    { id: 'dataSource', label: 'Data Source' },
    { id: 'shortDescription', label: 'Description' },
  ];

  displayedColumns = [
    'name',
    'type',
    'units',
    'dataSource',
  ];

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.parameters$.then(parameters => {
      this.dataSource.data = parameters;
    });
  }

  applyFilter(value: string) {
    this.dataSource.filter = value.trim().toLowerCase();
  }

  updateColumns(displayedColumns: string[]) {
    this.displayedColumns = displayedColumns;
  }
}