export interface Invitation {
  invitation: string; event: string; request: string; status: string; deadline: number;
  start: number; end: number; active: boolean; reason: string; details: string;
}
export interface EventDetails { title: string; description: string; venue: string; area: string; inviteBlurb: string; status?: string; accepted?: number; }
