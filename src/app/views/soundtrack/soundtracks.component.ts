import { Component, OnInit, ChangeDetectorRef, EventEmitter, Output, OnDestroy } from '@angular/core';
import { Observable, Subscription, ReplaySubject } from 'rxjs';
import { Soundtrack } from '@app/model/soundtrack';
import { SoundtrackStore } from '@app/store/soundtrack-store';
import { GeneratorService } from '@app/service/generator.service';
import { SynthService } from '@app/service/synth.service';
import { MelodyService } from '@app/service/melody.service';
import { SoundtrackService } from './soundtrack.service';
import { MatDialogConfig, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { SoundtrackDialogComponent } from './soundtrack-dialog.component';
import { SoundtrackEdition } from './soundtrack-edition';
import { TranslateService } from '@ngx-translate/core';
import { delay } from 'rxjs/operators';
import { MaterialService } from '@app/core/service/material.service';
import { MidiService } from '@app/service/midi.service';
import { MIDI_FILE_SUFFIX } from '@app/service/notation.constant ';
import { DownloadService } from '@stephaneeybert/lib-core';
import { Download } from '@stephaneeybert/lib-core/lib/download/download';
import { ProgressTask } from '@stephaneeybert/lib-core/lib/download/progress-task';

@Component({
  selector: 'app-soundtracks',
  templateUrl: './soundtracks.component.html',
  styleUrls: ['./soundtracks.component.css']
})
export class SoundtracksComponent implements OnInit, OnDestroy {

  soundtracks!: Array<Soundtrack>;
  private soundtracksSubscription?: Subscription;

  audioRunning$?: Observable<boolean>;
  audioTransportStarted$?: Observable<boolean>;

  dialogRef!: MatDialogRef<SoundtrackDialogComponent>;
  @Output()
  soundtrackEditedEvent: EventEmitter<Soundtrack> = new EventEmitter<Soundtrack>();

  download$?: Observable<Download>;

  private dialogEmitterSubscription?: Subscription;
  private dialogSubscription?: Subscription;

  constructor(
    private changeDetector: ChangeDetectorRef,
    private soundtrackStore: SoundtrackStore,
    private generatorService: GeneratorService,
    private melodyService: MelodyService,
    private synthService: SynthService,
    private soundtrackService: SoundtrackService,
    private materialService: MaterialService,
    private translateService: TranslateService,
    private matDialog: MatDialog,
    private midiService: MidiService,
    private downloadService: DownloadService
  ) {
  }

  ngOnInit() {
    this.observeSoundtracks();

    this.audioRunning$ = this.synthService.audioIsRunning$();
    this.audioTransportStarted$ = this.synthService.audioTransportIsStarted$();

    this.soundtrackStore.loadAllFromStorage();
  }

  ngOnDestroy() {
    if (this.soundtracksSubscription != null) {
      this.soundtracksSubscription.unsubscribe();
    }
    if (this.dialogSubscription != null) {
      this.dialogSubscription.unsubscribe();
    }
    if (this.dialogEmitterSubscription != null) {
      this.dialogEmitterSubscription.unsubscribe();
    }
  }

  generateSoundtrack(): void {
    if (this.soundtrackService.maximumNotYetReached()) {
      // const soundtrack2: Soundtrack = this.melodyService.addDummyMelody();
      const soundtrack: Soundtrack = this.generatorService.generateSoundtrack();
      const message: string = this.translateService.instant('soundtracks.message.added', { name: soundtrack.name });
      this.materialService.showSnackBar(message);
    } else {
      const message: string = this.translateService.instant('soundtracks.message.maxNbReached');
      this.materialService.showSnackBar(message);
    }
  }

  startTransport(): void {
    this.synthService.startTransport();
  }

  playSoundtrack(soundtrack: Soundtrack): void {
    this.synthService.playSoundtrack(soundtrack);
  }

  stopSoundtrack(soundtrack: Soundtrack): void {
    this.synthService.stopSoundtrack(soundtrack);
  }

  replaySoundtrack(soundtrack: Soundtrack): void {
    this.synthService.stopSoundtrack(soundtrack);
    this.synthService.playSoundtrack(soundtrack);
  }

  isNowPlaying(soundtrack: Soundtrack): boolean {
    return soundtrack.nowPlaying;
  }

  getNbSoundtracks(): number {
    return this.soundtracks != null ? this.soundtracks.length : 0;
  }

  deleteSoundtrack(soundtrack: Soundtrack): void {
    this.stopSoundtrack(soundtrack);
    if (this.soundtrackStore.delete(soundtrack)) {
      const message: string = this.translateService.instant('soundtracks.message.deleted', { name: soundtrack.name });
      this.materialService.showSnackBar(message);
    } else {
      const message: string = this.translateService.instant('soundtracks.message.notFound', { name: soundtrack.name });
      this.materialService.showSnackBar(message);
    }
  }

  openSoundtrackDialog(existingSoundtrack: Soundtrack) {
    const dialogConfig: MatDialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.hasBackdrop = true;
    dialogConfig.data = {
      soundtrack: existingSoundtrack
    };

    this.dialogRef = this.matDialog.open<SoundtrackDialogComponent>(SoundtrackDialogComponent, dialogConfig);

    this.dialogSubscription = this.dialogRef
      .afterClosed()
      .subscribe((soundtrackEdition: SoundtrackEdition) => {
        if (soundtrackEdition) {
          if (existingSoundtrack) {
            existingSoundtrack.name = soundtrackEdition.name;
            existingSoundtrack.copyright = soundtrackEdition.copyright;
            existingSoundtrack.lyrics = soundtrackEdition.lyrics;
            this.soundtrackService.setAndStoreSoundtrack(existingSoundtrack);

            this.soundtrackEditedEvent.emit(existingSoundtrack);
            const message: string = this.translateService.instant('soundtracks.message.updated', { name: existingSoundtrack.name });
            this.materialService.showSnackBar(message);
          }
        }
      });

    this.dialogEmitterSubscription = this.soundtrackEditedEvent
      .subscribe((soundtrack: Soundtrack) => {
        this.refreshSoundtrack(soundtrack);
      });
  }

  refreshSoundtrack(soundtrack: Soundtrack): void {
    console.log(soundtrack);
  }

  // Updating a view model in a subscribe() block requires an explicit call to the change detection
  private detectChanges(): void {
    this.changeDetector.detectChanges();
  }

  private observeSoundtracks(): void {
    this.soundtracksSubscription = this.soundtrackStore.getSoundtracks$()
      .pipe(
        delay(500)
      ).subscribe((soundtracks: Array<Soundtrack>) => {
        this.soundtracks = soundtracks;
        this.detectChanges();
      });
  }

  showMe: boolean = false;

  downloadSoundtrack(soundtrack: Soundtrack): void {
    const fileName: string = soundtrack.name + '.' + MIDI_FILE_SUFFIX;
    const progress$: Observable<ProgressTask<Uint8Array>> = this.midiService.progressiveCreateSoundtrackMidi(soundtrack);
    this.download$ = this.downloadService.downloadObservableDataAsBlobWithProgressAndSaveInFile(progress$, fileName);
    this.showMe = true;
    this.download$.subscribe((download: Download) => {
      console.log('Progress: ' + download.progress);
    });
    console.log('Call done');
  }

  downloadDemo(): void {
    this.download$ = this.downloadService.downloadUrlAsBlobWithProgressAndSaveInFile('assets/skypeforlinux-64.deb', 'demo')
    this.showMe = true;
    this.download$.subscribe((download: Download) => {
      console.log('Progress: ' + download.progress);
    });
    console.log('Call done');
  }

}
