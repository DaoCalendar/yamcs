import { ChangeDetectionStrategy, Component, OnDestroy, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Parameter } from '../../client';
import { Synchronizer } from '../../core/services/Synchronizer';
import { YamcsService } from '../../core/services/YamcsService';
import { subtractDuration } from '../../shared/utils';
import { DyDataSource } from '../../shared/widgets/DyDataSource';
import { ParameterPlot } from '../../shared/widgets/ParameterPlot';
import { ParameterSeries } from '../../shared/widgets/ParameterSeries';
import { CompareParameterDialog } from './CompareParameterDialog';
import { SelectRangeDialog } from './SelectRangeDialog';

@Component({
  templateUrl: './ParameterChartTab.html',
  styleUrls: ['./ParameterChartTab.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParameterChartTab implements OnDestroy {

  @ViewChild(ParameterPlot)
  plot: ParameterPlot;

  parameter$: Promise<Parameter>;
  dataSource: DyDataSource;
  missionTime: Date;

  range$ = new BehaviorSubject<string>('PT15M');
  customStart$ = new BehaviorSubject<Date | null>(null);
  customStop$ = new BehaviorSubject<Date | null>(null);

  constructor(route: ActivatedRoute, readonly yamcs: YamcsService, private dialog: MatDialog, synchronizer: Synchronizer) {
    this.missionTime = yamcs.getMissionTime();
    const qualifiedName = route.parent!.snapshot.paramMap.get('qualifiedName')!;
    this.dataSource = new DyDataSource(yamcs, synchronizer);
    this.parameter$ = yamcs.yamcsClient.getParameter(yamcs.instance!, qualifiedName);
    this.parameter$.then(parameter => {
      // Override qualified name for possible array or aggregate offsets
      parameter.qualifiedName = qualifiedName;
      this.dataSource.addParameter(parameter);
    });
  }

  loadLatest(range: string) {
    this.range$.next(range);
    const stop = this.yamcs.getMissionTime();
    const start = subtractDuration(stop, range);

    // Add some padding to the right
    const delta = stop.getTime() - start.getTime();
    stop.setTime(stop.getTime() + 0.05 * delta);

    this.dataSource.updateWindow(start, stop, [null, null]);
  }

  chooseRange() {
    const currentRange = this.plot.getDateRange();
    if (currentRange) {
      const dialogRef = this.dialog.open(SelectRangeDialog, {
        width: '400px',
        data: {
          start: currentRange[0],
          stop: currentRange[1],
        },
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.range$.next('CUSTOM');
          this.customStart$.next(result.start);
          this.customStop$.next(result.stop);
          this.dataSource.updateWindow(result.start, result.stop, [null, null]);
        }
      });
    }
  }

  compareParameter() {
    const dialogRef = this.dialog.open(CompareParameterDialog, {
      width: '600px',
      data: {
        exclude: this.plot.getParameters(),
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.yamcs.yamcsClient.getParameter(this.yamcs.instance!, result.qualifiedName).then(parameter => {
          const parameterConfig = new ParameterSeries();
          parameterConfig.parameter = parameter.qualifiedName;
          parameterConfig.color = result.color;
          parameterConfig.strokeWidth = result.thickness;
          this.plot.addParameter(parameter, parameterConfig);
        });
      }
    });
  }

  ngOnDestroy() {
    this.dataSource.disconnect();
  }
}
