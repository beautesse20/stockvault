import { NextResponse } from "next/server";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgkyOzAa3Xv3oyndWjwydkssGCW_KgXuwjdo9N-b02YnkksA2pmlk5iA5zzTlLqyjK/exec";

export async function POST() {
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=sync`, {
      method:  "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
