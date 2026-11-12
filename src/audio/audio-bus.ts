/** Silent bus. Cues arrive with the audio milestone. */
export class AudioBus {
  private muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  play(_cue: string): void {
    if (this.muted) return;
  }
}
