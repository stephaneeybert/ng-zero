import { Injectable } from '@angular/core';
import { Measure } from '@app/model/measure/measure';
import { NotationService } from './notation.service';
import { PlacedChord } from '@app/model/note/placed-chord';
import { Note } from '@app/model/note/note';
import { SoundtrackService } from '@app/views/soundtrack/soundtrack.service';
import { TranslateService } from '@ngx-translate/core';
import { Soundtrack } from '@app/model/soundtrack';
import { TempoUnit } from '@app/model/tempo-unit';
import { Track } from '@app/model/track';
import { CommonService } from '@stephaneeybert/lib-core';
import { TRACK_TYPES } from './notation.service';
import { SettingsService } from '@app/views/settings/settings.service';
import { RANDOM_METHOD } from './notation.constant ';

const DEFAULT_VELOCITY_SOFTER: number = 0.1;
const DEFAULT_VELOCITY_LOUDER: number = 1;

@Injectable({
  providedIn: 'root'
})
export class GeneratorService {

  constructor(
    private commonService: CommonService,
    private soundtrackService: SoundtrackService,
    private notationService: NotationService,
    private settingsService: SettingsService,
    private translateService: TranslateService,
  ) { }

  CHROMA_SHIFT_TIMES: number = 2;
  SIMILAR_NOTE_MIN: number = 2;

  private createPlacedChords(velocity: number, generatedChords: Array<Array<string>>): Array<PlacedChord> {
    let placedChordIndex: number = 0;
    const createdPlacedChords: Array<PlacedChord> = generatedChords
      .map((chord: Array<string>) => {
        let noteIndex: number = 0;
        const notes: Array<Note> = chord.map((textNote: string) => {
          const note: Note = this.notationService.createNote(noteIndex, textNote, this.settingsService.getSettings().generateNoteOctave);
          noteIndex++;
          return note;
        })
        const placedChord: PlacedChord = this.notationService.createPlacedChord(placedChordIndex, this.settingsService.getSettings().generateChordDuration, TempoUnit.DUPLE, velocity, notes);
        placedChordIndex++;
        return placedChord;
      });
    this.notationService.addEndOfTrackNote(createdPlacedChords);
    return createdPlacedChords;
  }

  private createMeasures(generatedChords: Array<PlacedChord>): Array<Measure> {
    let measureIndex: number = 0;
    let chordIndex: number = 0;
    const measures: Array<Measure> = new Array<Measure>();
    const tempoBpm: number = this.settingsService.getSettings().generateTempoBpm;
    const timeSignatureNumerator: number = this.settingsService.getSettings().generateTimeSignatureNumerator;
    const timeSignatureDenominator: number = this.settingsService.getSettings().generateTimeSignatureDenominator;
    let measure: Measure = this.notationService.createMeasure(measureIndex, tempoBpm, timeSignatureNumerator, timeSignatureDenominator);
    measure.placedChords = new Array<PlacedChord>();
    generatedChords
      .map((placedChord: PlacedChord) => {
        if (measure.placedChords) {
          // The number of beats of the chords placed in a measure must equal the number of beats of the measure
          if (measure.getPlacedChordsNbBeats() >= measure.getNbBeats()) {
            measures.push(measure);
            measure = this.notationService.createMeasure(measureIndex, tempoBpm, timeSignatureNumerator, timeSignatureDenominator);
            measure.placedChords = new Array<PlacedChord>();
            measureIndex++;
            chordIndex = 0;
          }
          placedChord.index = chordIndex;
          chordIndex++;
          measure.placedChords.push(placedChord);
        } else {
          throw new Error('The measure placed chords array has not been instantiated.');
        }
      });
    return measures;
  }

  public generateSoundtrack(): Soundtrack {
    const soundtrack: Soundtrack = this.soundtrackService.createSoundtrack(this.assignNewName());
    const symphonyChords: Array<Array<string>> = this.generateChords();
    const melodyChords: Array<Array<string>> = this.generateMasterNoteChords(symphonyChords);
    const melodyTrack: Track = soundtrack.addTrack(this.createMeasures(this.createPlacedChords(DEFAULT_VELOCITY_LOUDER, melodyChords)));
    melodyTrack.name = this.getTrackName(TRACK_TYPES.MELODY);

    const generateSymphony: boolean = this.settingsService.getSettings().generateSymphony;
    if (generateSymphony) {
      const symphonyTrack: Track = soundtrack.addTrack(this.createMeasures(this.createPlacedChords(DEFAULT_VELOCITY_SOFTER, symphonyChords)));
      symphonyTrack.name = this.getTrackName(TRACK_TYPES.SYMPHONY);
      symphonyTrack.displayChordNames = true;
    }

    const generateDrums: boolean = this.settingsService.getSettings().generateDrums;
    if (generateDrums) {
      const drumsTrack: Track = soundtrack.addTrack(this.createMeasures(this.createPlacedChords(DEFAULT_VELOCITY_SOFTER, symphonyChords)));
      drumsTrack.name = this.getTrackName(TRACK_TYPES.DRUMS);
      drumsTrack.displayChordNames = true;
    }

    const generateBass: boolean = this.settingsService.getSettings().generateBass;
    if (generateBass) {
      const bassTrack: Track = soundtrack.addTrack(this.createMeasures(this.createPlacedChords(DEFAULT_VELOCITY_SOFTER, symphonyChords)));
      bassTrack.name = this.getTrackName(TRACK_TYPES.BASS);
      bassTrack.displayChordNames = true;
    }

    this.soundtrackService.storeSoundtrack(soundtrack);
    return soundtrack;
  }

  private getTrackName(trackType: string): string {
    return this.translateService.instant('music.notation.track.' + trackType);
  }

  private assignNewName(): string {
    return this.translateService.instant('soundtracks.assignedName') + '_' + this.commonService.getRandomString(4);
  }

  private createArrayShiftOnceLeft(items: Array<string>): Array<string> {
    // Make a deep copy
    let shiftedItems: Array<string> = new Array();
    items.map((chroma: string) => {
      shiftedItems.push(chroma);
    })

    // Shift the copy and not the original
    const item: string | undefined = shiftedItems.shift();
    shiftedItems.push(item!);
    return shiftedItems;
  }

  private createArrayShiftOnceRight(items: Array<string>): Array<string> {
    // Make a deep copy
    let shiftedItems: Array<string> = new Array();
    items.map((chroma: string) => {
      shiftedItems.push(chroma);
    })

    // Shift the copy and not the original
    const item: string | undefined = shiftedItems.pop();
    shiftedItems.unshift(item!);
    return shiftedItems;
  }

  private createShiftedChromas(chromas: Array<string>): Array<string> {
    for (var i = 0; i < this.CHROMA_SHIFT_TIMES; i++) {
      chromas = this.createArrayShiftOnceLeft(chromas);
    }
    return chromas;
  }

  // Check if the chord shares a minimum number of notes with its previous chord
  private isSimilarToPrevious(previousChord: Array<string>, chord: Array<string>): boolean {
    let nbSameNotes: number = 0;
    for (var i = 0; i < this.settingsService.getSettings().generateChordWidth; i++) {
      if (previousChord.includes(chord[i])) {
        nbSameNotes++;
      }
    }
    return (nbSameNotes >= this.SIMILAR_NOTE_MIN);
  }

  private createShiftedChord(chord: Array<string>): Array<string> {
    return this.createArrayShiftOnceRight(chord);
  }

  private generateMasterNoteChords(symphonieChords: Array<Array<string>>): Array<Array<string>> {
    const melodyChords: Array<Array<string>> = new Array();
    symphonieChords.forEach((chords: Array<string>) => {
      const masterNote: string = chords[0];
      const melodyChord: Array<string> = new Array();
      melodyChord.push(masterNote);
      melodyChords.push(melodyChord);
    });
    return melodyChords;
  }

  private generateChords(): Array<Array<string>> {
    const shiftedChromas: Array<Array<string>> = new Array();
    const chords: Array<Array<string>> = new Array();
    // Create shifted chromas, each starting some notes down the previous chroma
    // The number of shifted chromas is the width of the chord
    //  Do Re.m  Mi.m  Fa  Sol  La.m  Si-
    // 'C', 'D', 'E', 'F', 'G', 'A', 'B'
    // 'E', 'F', 'G', 'A', 'B', 'C', 'D'
    // 'G', 'A', 'B', 'C', 'D', 'E', 'F'

    // Build the shifted chromas
    shiftedChromas[0] = this.notationService.chromasAlphabetical();
    for (let index = 1; index < this.settingsService.getSettings().generateChordWidth; index++) {
      shiftedChromas[index] = this.createShiftedChromas(shiftedChromas[index - 1]);
    }

    let previousChord: Array<string> = new Array();
    let previousChromaNoteIndex: number = 0;
    let nbAddedChord: number = 0;
    while (nbAddedChord < this.settingsService.getSettings().generateNbChords) {
      const chord: Array<string> = new Array();

      // For each randomly picked chroma, add its chord to an array
      const chromaNoteIndex: number = (nbAddedChord === 0) ? 0 : this.randomlyPickChroma(previousChromaNoteIndex);
      for (let noteIndex = 0; noteIndex < this.settingsService.getSettings().generateChordWidth; noteIndex++) {
        chord.push(shiftedChromas[noteIndex][chromaNoteIndex]);
      }

      // Consider a chord only if it is similar to its previous one
      if (chords.length === 0 || this.isSimilarToPrevious(previousChord, chord)) {
        previousChromaNoteIndex = chromaNoteIndex;
        previousChord = chord;
        // Add twice the same chord
        chords.push(chord);
        nbAddedChord++;
        chords.push(chord); // TODO Do we still double the notes ?
        nbAddedChord++;
      } else {
        // TODO Do we still reverse the notes ?
        // If the current chord is too dissimilar from its previous one
        // then create a chord from a reversing of the previous one
        if (this.settingsService.getSettings().generateReverseDissimilarChord) {
          const slidedChord: Array<string> = this.createShiftedChord(previousChord);
          chords.push(chord);
          nbAddedChord++;
        }
      }
    }
    return chords;
  }

  private randomlyPickChroma(chromaIndex: number): number {
    const randomMethod: RANDOM_METHOD = this.settingsService.getSettings().generateMethod;
    if (RANDOM_METHOD.BASE == randomMethod) {
      return this.randomlyPickChromaFromBaseChromas(chromaIndex);
    } else if (RANDOM_METHOD.BONUS_TABLE == randomMethod) {
      return this.randomlyPickChromaFromChromasPool(chromaIndex);
    } else {
      throw new Error('The selected random method does not exist.');
    }
  }

  private randomlyPickChromaFromBaseChromas(chromaIndex: number): number {
    return this.commonService.getRandomIntegerBetweenAndExcept(0, this.notationService.chromasAlphabetical().length - 1, [ chromaIndex ])
  }

  // The table of bonus per chroma
  // For a given chroma there is a series of bonus numbers
  // A bonus represents the level of harmony between a chroma and its following chroma
  // The chromas are indexed in the chromas alphabetical array
  private getBonusTable(): Array<Array<number>> {
    const matrix: Array<Array<number>> = [
    //  C  D  E  F  G  A  B
      [ 30, 0, 15, 5, 5, 10, 0 ],
      [ 0, 30, 0, 10, 0, 5, 10 ],
      [ 15, 0, 30, 0, 10, 0, 0 ],
      [ 5, 10, 0, 30, 0, 15, 0 ],
      [ 5, 0, 10, 0, 30, 0, 10 ],
      [ 10, 5, 0, 15, 0, 30, 0 ],
      [ 0, 10, 0, 0, 10, 0, 30 ]
    ];
    return matrix;
  }

  private getChromaBonuses(chromaIndex: number): Array<number> {
    return this.getBonusTable()[chromaIndex];
  }

  private buildUpChromasPoolFromBonuses(chromaIndex: number): Array<number> {
    const RANDOMLINESS: number = 0;
    const MIN_BONUS: number = 3;
    const chromaBonuses: Array<number> = this.getChromaBonuses(chromaIndex);
    let currentChromaIndex: number = 0;
    const chromasPool: Array<number> = new Array();
    chromaBonuses.forEach((chromaBonus: number) => {
      // If a minimum bonus is specified then do not consider the chromas that have a lower bonus
      if ((MIN_BONUS > 0 && chromaBonus >= MIN_BONUS) || 0 === MIN_BONUS) {
        // The higher the more random
        chromaBonus += RANDOMLINESS;
        for (let nb = 0; nb < chromaBonus; nb++) {
          chromasPool.push(currentChromaIndex);
        }
      }
      currentChromaIndex++;
    });
    return chromasPool;
  }

  private randomlyPickChromaFromChromasPool(chromaIndex: number): number {
    const chromasPool: Array<number> = this.buildUpChromasPoolFromBonuses(chromaIndex);
    const random: number = this.commonService.getRandomIntegerBetween(0, chromasPool.length - 1);
    return chromasPool[random];
  }

}