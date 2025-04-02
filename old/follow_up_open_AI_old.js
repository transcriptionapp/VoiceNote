import { supabase, OPENAI_API_KEY, ASSISTANT_ID, getUserId } from "../js/config.js";

const params = new URLSearchParams(window.location.search);
const transcriptionId = params.get("recording_id");
let originalDraft = "";

window.addEventListener("DOMContentLoaded", async () => {
  const loader = document.getElementById("loadingAnimation");
  const emailBox = document.getElementById("emailDraft");
  const saveBtn = document.getElementById("saveFollowUpBtn");
  const gmailBtn = document.getElementById("sendViaGmail");

  console.log("🔍 transcriptionId:", transcriptionId);

  if (!loader || !emailBox || !saveBtn || !gmailBtn) {
    console.error("❌ One or more required DOM elements are missing");
    return;
  }

  if (!transcriptionId) {
    emailBox.value = "❌ No transcription ID found in the URL.";
    return;
  }

  loader.style.display = "block";

  const text = await fetchTranscript(transcriptionId);
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
    const updatedText = emailBox.value.trim();
    if (!updatedText || updatedText === originalDraft) return;

    const { error } = await supabase
      .from("follow_ups")
      .update({ email_draft: updatedText, is_edited: true })
      .eq("transcription_id", transcriptionId);

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
    const threadRes = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
      }
    });
    const thread = await threadRes.json();
    const threadId = thread?.id;
    if (!threadId) throw new Error("Thread creation failed");

    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({ role: "user", content: text })
    });

    const runRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({ assistant_id: ASSISTANT_ID })
    });

    const run = await runRes.json();
    if (!run?.id) throw new Error("Run initiation failed");

    let status = run.status;
    while (status !== "completed" && status !== "failed") {
      await new Promise(r => setTimeout(r, 1500));
      const pollRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${run.id}`, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "assistants=v2"
        }
      });
      const pollData = await pollRes.json();
      status = pollData.status;
    }

    const msgRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "assistants=v2"
      }
    });
    const msgData = await msgRes.json();
    const reply = msgData.data.find(m => m.role === "assistant")?.content?.[0]?.text?.value?.trim();

    if (!reply) throw new Error("No reply from assistant");

    const userId = await getUserId();
    if (!userId) throw new Error("User not authenticated");

    const { error: insertError } = await supabase
      .from("follow_ups")
      .upsert({
        transcription_id: transcriptionId,
        email_draft: reply,
        user_id: userId
      }, { onConflict: "transcription_id" });

    if (insertError) throw insertError;

    await supabase
      .from("transcriptions")
      .update({ follow_up_status: "generated" })
      .eq("recording_id", transcriptionId);

    return reply;
  } catch (err) {
    console.error("❌ Assistant generation failed:", err);
    return `❌ Assistant failed to generate follow-up email: ${err.message}`;
  }
}