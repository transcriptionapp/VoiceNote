import { supabase, getUserId } from "../js/config.js";

const params = new URLSearchParams(window.location.search);
const recordingId = params.get("recording_id");
let originalDraft = "";

window.addEventListener("DOMContentLoaded", async () => {
  const loader = document.getElementById("loadingAnimation");
  const emailBox = document.getElementById("emailDraft");
  const saveBtn = document.getElementById("saveFollowUpBtn");
  const gmailBtn = document.getElementById("sendViaGmail");

  console.log("🔍 recordingId:", recordingId);

  if (!loader || !emailBox || !saveBtn || !gmailBtn) {
    console.error("❌ One or more required DOM elements are missing");
    return;
  }

  if (!recordingId) {
    emailBox.value = "❌ No recording ID found in the URL.";
    return;
  }

  loader.style.display = "block";

  const text = await fetchTranscript(recordingId);
  console.log("📄 Raw transcription text:", text);

  if (!text) {
    loader.style.display = "none";
    emailBox.value = "❌ No transcription text found.";
    return;
  }

  const draft = await generateEmailWithAssistant(text);

  loader.style.display = "none";
  emailBox.value = draft;
  originalDraft = draft;
  saveBtn.classList.add("hidden");

  saveBtn.addEventListener("click", async () => {
    const userId = await getUserId();
    if (!userId) {
      console.error("❌ User not authenticated");
      return;
    }

    const updatedText = emailBox.value.trim();
    if (!updatedText || updatedText === originalDraft) return;

    const { error } = await supabase
      .from("follow_ups")
      .update({ email_draft: updatedText, is_edited: true })
      .eq("recording_id", recordingId)
      .eq("user_id", userId);

    if (error) {
      console.error("❌ Failed to save edited draft:", error);
    } else {
      originalDraft = updatedText;
      saveBtn.classList.add("hidden");
    }
  });

  emailBox.addEventListener("input", () => {
    saveBtn.classList.toggle("hidden", emailBox.value.trim() === originalDraft.trim());
  });

  gmailBtn.addEventListener("click", () => {
    alert("📤 Gmail integration coming soon!");
  });
});

async function fetchTranscript(id) {
  const { data, error } = await supabase
    .from("transcriptions")
    .select("text, edited_text, created_at")
    .eq("recording_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("❌ Error fetching transcription from Supabase:", error);
    return "";
  }

  return data?.edited_text?.trim() || data?.text?.trim() || "";
}

async function generateEmailWithAssistant(text) {
  try {
    const userId = await getUserId();
    if (!userId) throw new Error("User not authenticated");

    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error("No access token available");

    const response = await fetch("https://fxuafoiuwzsjezuqzjgn.functions.supabase.co/generate-follow-up", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        transcription_id: recordingId,
        user_id: userId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge Function error: ${response.status} - ${errorText}`);
    }

    const { email_text } = await response.json();
    return email_text || "⚠️ No email draft returned.";
  } catch (err) {
    console.error("❌ Assistant generation failed:", err);
    return `❌ Assistant failed to generate follow-up email: ${err.message}`;
  }
}