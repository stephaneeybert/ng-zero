import { Component, OnInit } from '@angular/core';
import { MidiService } from '../../lib/service/midi.service';
import { Soundtrack } from '../../model/soundtrack';
import { SoundtrackStore } from '../../lib/store/soundtrack-store';

@Component({
  selector: 'upload',
  templateUrl: './upload.component.html',
})
export class UploadComponent implements OnInit {

  rawMidiData?: ArrayBuffer;
  soundtrack?: Soundtrack;

  constructor(
    private soundtrackStore: SoundtrackStore,
    private midiService: MidiService
  ) { }

  ngOnInit() {
  }

  public onUpload(fileList: FileList) {
    const file = fileList[0];
    const fileReader: FileReader = new FileReader();
    fileReader.onloadend = (event: Event) => {
      this.rawMidiData = fileReader.result as ArrayBuffer;
      // TODO Remove this this.midiService.parseRawMidi(file.name, this.rawMidiData).then((soundtrack: Soundtrack) => {
      this.midiService.parseRawMidiTonejs(file.name, this.rawMidiData).then((soundtrack: Soundtrack) => { // TODO
        this.soundtrack = soundtrack;
        console.log(this.soundtrack);
        this.soundtrackStore.add(soundtrack);
      });
    };
    fileReader.readAsArrayBuffer(file);
  }

}