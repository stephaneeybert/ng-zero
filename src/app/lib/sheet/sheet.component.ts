import { Component, Input, AfterViewInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { Device } from '../../model/device';
import { SheetService } from '../service/sheet.service';
import { Soundtrack } from '../../model/soundtrack';
import { Subscription, Subject, ReplaySubject } from 'rxjs';
import { CommonService } from '../service/common.service';

const NAME_PREFIX_SOUNDTRACK = 'sheet-soundtrack-';
const NAME_PREFIX_DEVICE = 'sheet-device-';

@Component({
  selector: 'midi-sheet',
  templateUrl: './sheet.component.html',
  styleUrls: ['./sheet.component.css']
})
export class SheetComponent implements AfterViewInit {

  private soundtrack$: Subject<Soundtrack> = new ReplaySubject<Soundtrack>();
  // KNOW A setter with the very same name as the variable can be used in place of the variable
  @Input()
  set soundtrack(soundtrack: Soundtrack) {
    this.soundtrack$.next(soundtrack);
  };

  private device$: Subject<Device> = new ReplaySubject<Device>();
  // KNOW A setter with the very same name as the variable can be used in place of the variable
  @Input()
  set device(device: Device) {
    this.device$.next(device);
  };

  private soundtrackSubscription!: Subscription;
  private deviceSubscription!: Subscription;

  id!: string;

  screenWidth!: number;

  constructor(
    private changeDetector: ChangeDetectorRef,
    private sheetService: SheetService,
    private commonService: CommonService
  ) { }

  ngAfterViewInit() {
    this.initScreenWidth();

    this.soundtrackSubscription = this.soundtrack$
      .subscribe((soundtrack: Soundtrack) => {
        this.initializeWithSoundtrackId(soundtrack);
      });

    this.deviceSubscription = this.device$
      .subscribe((device: Device) => {
        this.initializeWithDeviceId(device);
      });
  }

  private initScreenWidth(): void {
    this.screenWidth = this.commonService.getScreenInnerWidth();
  }

  @HostListener("window:resize", [])
  public onResize() {
    this.initScreenWidth();
  }

  ngOnDestroy() {
    if (this.soundtrackSubscription != null) {
      this.soundtrackSubscription.unsubscribe();
    }
    if (this.deviceSubscription != null) {
      this.deviceSubscription.unsubscribe();
    }
  }

  // Updating a view model in a subscribe() block requires an explicit call to the change detection
  private detectChanges(id: string): void {
    this.id = id;
    // Detect the change AFTER the id has been set
    this.changeDetector.detectChanges();
  }

  private initializeWithSoundtrackId(soundtrack: Soundtrack): void {
    if (soundtrack != null) {
      // Refresh the view with its id before creating the sheet
      this.detectChanges(NAME_PREFIX_SOUNDTRACK + soundtrack.id);
      this.createSoundtrackSheet(soundtrack);
    }
  }

  private initializeWithDeviceId(device: Device): void {
    if (device != null) {
      // Refresh the view with its id before creating the sheet
      this.detectChanges(NAME_PREFIX_DEVICE + device.id);
      this.createDeviceSheet(device);
    }
  }

  private createSoundtrackSheet(soundtrack: Soundtrack): void {
    if (soundtrack != null) {
      if (soundtrack.hasNotes()) {
        this.sheetService.createSoundtrackSheet(this.id, this.screenWidth, soundtrack);
      }
    }
  }

  private createDeviceSheet(device: Device): void {
    if (device != null) {
      this.sheetService.vexflowRenderDevice(this.id, this.screenWidth, device);
    }
  }

}