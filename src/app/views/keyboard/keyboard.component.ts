import { Component, AfterViewInit, Input, ChangeDetectorRef, HostListener, ViewChild } from '@angular/core';
import { KeyboardService } from '@app/service/keyboard.service';
import { SynthService } from '@app/service/synth.service';
import { SoundtrackStore } from '@app/store/soundtrack-store';
import { DeviceStore } from '@app/store/device-store';
import { Subscription, ReplaySubject, Subject, Observable, combineLatest } from 'rxjs';
import { Soundtrack } from '@app/model/soundtrack';
import { Device } from '@app/model/device';
import { delay } from 'rxjs/operators';
import { ScreenDeviceService } from '@stephaneeybert/lib-core';
import { SettingsStore } from '@app/store/settings-store';
import { Settings } from '@app/model/settings';

const LIVE_KEYBOARD_MIDI_VELOCITY: number = 127;

@Component({
  selector: 'app-midi-keyboard',
  templateUrl: './keyboard.component.html'
})
export class KeyboardComponent implements AfterViewInit {

  private soundtrack$: Subject<Soundtrack> = new ReplaySubject<Soundtrack>();
  // HINT: A setter with the very same name as the variable can be used in place of the variable
  @Input()
  set soundtrack(soundtrack: Soundtrack) {
    this.soundtrack$.next(soundtrack);
  };

  private device$: Subject<Device> = new ReplaySubject<Device>();
  // HINT: A setter with the very same name as the variable can be used in place of the variable
  @Input()
  set device(device: Device) {
    this.device$.next(device);
  };

  private soundtrackSubscription?: Subscription;
  private deviceSubscription?: Subscription;

  id?: string;

  screenWidth!: number;

  constructor(
    private changeDetector: ChangeDetectorRef,
    private soundtrackStore: SoundtrackStore,
    private deviceStore: DeviceStore,
    private keyboardService: KeyboardService,
    private synthService: SynthService,
    private screenDeviceService: ScreenDeviceService,
    private settingsStore: SettingsStore
  ) { }

  ngAfterViewInit() {
    this.initScreenWidth();

    const soundtrackAndSettings$: Observable<[Soundtrack, Settings]> = combineLatest(
      this.soundtrack$.pipe(delay(0)),
      this.settingsStore.getSettings$()
    );

    this.soundtrackSubscription = soundtrackAndSettings$
    // Wait for a change detection so as to get the soundtracks at loading time
    // See https://stackoverflow.com/q/61043063/958373
    .pipe(delay(0))
    .subscribe(([soundtrack, settings]: [Soundtrack, Settings]) => {
      this.initializeWithSoundtrackId(soundtrack, settings.showKeyboard);
    });

    this.deviceSubscription = this.device$
    .pipe(delay(0))
    .subscribe((device: Device) => {
      this.initializeWithDeviceId(device);
    });
  }

  private initScreenWidth(): void {
    this.screenWidth = this.screenDeviceService.getScreenInnerWidth();
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
  private setIdAndDetectChanges(id: string): void {
    this.id = id;
    // Detect the change AFTER the id has been set
    this.changeDetector.detectChanges();
  }

  private initializeWithSoundtrackId(soundtrack: Soundtrack, showKeyboard: boolean): void {
    if (soundtrack != null) {
      // Refresh the view with its id before creating the keyboard
      this.setIdAndDetectChanges(this.keyboardService.buildSoundtrackKeyboardId(soundtrack.id));
      this.createSoundtrackKeyboard(soundtrack, showKeyboard);
    }
  }

  private initializeWithDeviceId(device: Device): void {
    if (device != null) {
      // Refresh the view with its id before creating the keyboard
      this.setIdAndDetectChanges(this.keyboardService.buildDeviceKeyboardId(device.id));
      this.createDeviceKeyboard(device);
    }
  }

  private createSoundtrackKeyboard(soundtrack: Soundtrack, showKeyboard: boolean): void {
    if (showKeyboard) {
      this.keyboardService.domShow(this.keyboardService.buildSoundtrackKeyboardId(soundtrack.id));
      if (soundtrack.keyboard == null) {
        const keyboard: any = this.keyboardService.createKeyboard(this.keyboardService.buildSoundtrackKeyboardId(soundtrack.id), this.screenWidth);
        this.soundtrackStore.setSoundtrackKeyboard(soundtrack, keyboard);
      }
    } else {
      this.keyboardService.domHide(this.keyboardService.buildSoundtrackKeyboardId(soundtrack.id));
      if (soundtrack.keyboard != null) {
        this.keyboardService.removeKeyboardDomElement(this.keyboardService.buildSoundtrackKeyboardId(soundtrack.id));
        this.soundtrackStore.setSoundtrackKeyboard(soundtrack, undefined);
      }
    }
  }

  private createDeviceKeyboard(device: Device): void {
    if (device.keyboard != null) {
      this.keyboardService.removeKeyboardDomElement(this.keyboardService.buildDeviceKeyboardId(device.id));
    }
    const keyboard: any = this.keyboardService.createKeyboard(this.keyboardService.buildDeviceKeyboardId(device.id), this.screenWidth);
    this.deviceStore.setDeviceKeyboard(device, keyboard);
    this.playSoundFromKeyboard(keyboard, device.synth);
  }

  private playSoundFromKeyboard(keyboard: any, synth: any) {
    keyboard.on('change', (note: any) => {
      if (note.state) {
        this.synthService.noteOn(note.note, LIVE_KEYBOARD_MIDI_VELOCITY, synth);
      } else {
        this.synthService.noteOff(note.note, synth);
      }
    });
  }
}
