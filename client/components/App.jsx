import { useEffect, useRef, useState } from "react";
import logo from "/assets/openai-logomark.svg";
import EventLog from "./EventLog";
import SessionControls from "./SessionControls";
import ToolPanel from "./ToolPanel";
import BenchmarkPanel from "./BenchmarkPanel";
import { BenchmarkingService } from "../lib/BenchmarkingService.js";

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const peerConnection = useRef(null);

  // Benchmarking state
  const [isBenchmarkMode, setIsBenchmarkMode] = useState(false);
  const [benchmarkTranscript, setBenchmarkTranscript] = useState([]);
  const [benchmarkLog, setBenchmarkLog] = useState([]);
  const benchmarkingService = useRef(null);

  // Initialize benchmarking service
  useEffect(() => {
    benchmarkingService.current = new BenchmarkingService();

    // Set up callbacks for UI updates
    benchmarkingService.current.onTranscriptUpdate = setBenchmarkTranscript;
    benchmarkingService.current.onLogUpdate = setBenchmarkLog;
    benchmarkingService.current.onRunComplete = (runData) => {
      console.log('Benchmark run completed:', runData);
    };
  }, []);

  async function startSession() {
    // Get a session token for OpenAI Realtime API
    const tokenResponse = await fetch("/token");
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.value;

    // Create a peer connection
    const pc = new RTCPeerConnection();

    // Receive model audio, but DO NOT send mic audio
    pc.addTransceiver("audio", { direction: "recvonly" });

    // Create / reuse an <audio> element to play the remote stream
    if (!window.__oaiRemoteAudioEl) {
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioEl.playsInline = true; // iOS/Safari friendliness
      audioEl.muted = false;
      document.body.appendChild(audioEl);
      window.__oaiRemoteAudioEl = audioEl;
    }
    const audioEl = window.__oaiRemoteAudioEl;

    // Attach remote tracks to the audio element so you can hear them
    pc.ontrack = (event) => {
      if (event.track.kind === "audio") {
        audioEl.srcObject = event.streams[0];
        // Autoplay policies: try to start playback (works best if startSession is called from a click)
        audioEl.play().catch((err) => {
          console.warn("[App] Remote audio autoplay blocked; user gesture required.", err);
        });
      }
    };

    // Helpful debugging
    pc.onconnectionstatechange = () => console.log("[App] pc.connectionState:", pc.connectionState);
    pc.oniceconnectionstatechange = () => console.log("[App] pc.iceConnectionState:", pc.iceConnectionState);

    // Set up data channel for sending and receiving events
    const dc = pc.createDataChannel("oai-events");
    setDataChannel(dc);

    // Start the session using the Session Description Protocol (SDP)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const baseUrl = "https://api.openai.com/v1/realtime/calls";
    const sdpResponse = await fetch(baseUrl, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

  // ✅ Guard: ensure we actually got SDP back (not JSON/HTML error)
  const sdpText = await sdpResponse.text();
  if (!sdpResponse.ok || !sdpText.trim().startsWith("v=")) {
    console.error("[App] Realtime /calls failed:", sdpResponse.status, sdpText);
    throw new Error(`Realtime /calls failed: ${sdpResponse.status}`);
  }

  const answer = { type: "answer", sdp: sdpText };
  await pc.setRemoteDescription(answer);

  peerConnection.current = pc;
}


  // Stop current session, clean up peer connection and data channel
  function stopSession() {
    // Stop benchmarking if active
    if (benchmarkingService.current && benchmarkingService.current.isActive()) {
      benchmarkingService.current.endRun();
    }

    if (dataChannel) {
      dataChannel.close();
    }

    peerConnection.current.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
      }
    });

    if (peerConnection.current) {
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
  }

  // Benchmarking control functions
  function startBenchmarkRun() {
    if (!isSessionActive || !benchmarkingService.current) {
      console.warn('Cannot start benchmark: session not active');
      return;
    }

    setIsBenchmarkMode(true);
    setBenchmarkTranscript([]);
    setBenchmarkLog([]);
    benchmarkingService.current.startRun(sendTextMessage, events);
  }

  function endBenchmarkRun() {
    if (benchmarkingService.current) {
      benchmarkingService.current.endRun();
    }
    setIsBenchmarkMode(false);
  }

  function resetBenchmark() {
    if (benchmarkingService.current) {
      benchmarkingService.current.endRun();
    }
    setIsBenchmarkMode(false);
    setBenchmarkTranscript([]);
    setBenchmarkLog([]);
  }

  // Send a message to the model
  function sendClientEvent(message) {
    if (dataChannel) {
      const timestamp = new Date().toLocaleTimeString();
      message.event_id = message.event_id || crypto.randomUUID();

      // send event before setting timestamp since the backend peer doesn't expect this field
      dataChannel.send(JSON.stringify(message));

      // if guard just in case the timestamp exists by miracle
      if (!message.timestamp) {
        message.timestamp = timestamp;
      }
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }

  // Send a text message to the model
  function sendTextMessage(message) {
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    };

    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
  }

  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (dataChannel) {
      // Append new server events to the list
      dataChannel.addEventListener("message", (e) => {
        const event = JSON.parse(e.data);
        if (!event.timestamp) {
          event.timestamp = new Date().toLocaleTimeString();
        }

        setEvents((prev) => [event, ...prev]);
      });

      // Set session active when the data channel is opened
      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setEvents([]);
      });
    }
  }, [dataChannel]);

  // Monitor events for benchmarking (with debounce to avoid excessive calls)
  useEffect(() => {
    if (benchmarkingService.current && benchmarkingService.current.isActive()) {
      const timeoutId = setTimeout(() => {
        benchmarkingService.current.monitorConversation(events);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [events]);

  return (
    <>
      <nav className="absolute top-0 left-0 right-0 h-16 flex items-center">
        <div className="flex items-center gap-4 w-full m-4 pb-2 border-0 border-b border-solid border-gray-200">
          <img style={{ width: "24px" }} src={logo} />
          <h1>realtime console</h1>
        </div>
      </nav>
      <main className="absolute top-16 left-0 right-0 bottom-0">
        <section className="absolute top-0 left-0 right-[380px] bottom-0 flex">
          <section className="absolute top-0 left-0 right-0 bottom-32 px-4 overflow-y-auto">
            <EventLog events={events} />
          </section>
          <section className="absolute h-32 left-0 right-0 bottom-0 p-4">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              events={events}
              isSessionActive={isSessionActive}
            />
          </section>
        </section>
        <section className="absolute top-0 w-[380px] right-0 bottom-0 p-4 pt-0 overflow-y-auto">
          {isBenchmarkMode ? (
            <BenchmarkPanel
              isSessionActive={isSessionActive}
              isBenchmarkActive={benchmarkingService.current?.isActive() || false}
              benchmarkTranscript={benchmarkTranscript}
              benchmarkLog={benchmarkLog}
              simulatedUserPrompt={benchmarkingService.current?.getSimulatedUserPrompt() || ''}
              onStartBenchmark={startBenchmarkRun}
              onEndBenchmark={endBenchmarkRun}
              onResetBenchmark={resetBenchmark}
              onToggleMode={() => setIsBenchmarkMode(!isBenchmarkMode)}
            />
          ) : (
            <ToolPanel
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              events={events}
              isSessionActive={isSessionActive}
              onToggleMode={() => setIsBenchmarkMode(!isBenchmarkMode)}
            />
          )}
        </section>
      </main>
    </>
  );
}
