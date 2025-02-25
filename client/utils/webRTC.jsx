export async function startWebRTCConnection(setDataChannel, setIsSessionActive) {
    const tokenResponse = await fetch("/token");
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    const pc = new RTCPeerConnection();

    // Set up to play remote audio from the model
    const audioElement = document.createElement("audio");
    audioElement.autoplay = true;
    pc.ontrack = (e) => (audioElement.srcObject = e.streams[0]);

    const audioContext = new AudioContext();
    let ms = audioContext.createMediaStreamDestination().stream;
    if (import.meta.env?.VITE_USE_MIC?.toLowerCase?.() === 'true') {
        console.log('use mic');
        ms = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    pc.addTrack(ms.getTracks()[0]);

    // Set up data channel for sending and receiving events
    const dc = pc.createDataChannel("oai-events");
    setDataChannel(dc);

    // Start the session using the Session Description Protocol (SDP)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
        },
    });

    const answer = {
        type: "answer",
        sdp: await sdpResponse.text(),
    };
    await pc.setRemoteDescription(answer);

    // Set up event listeners
    dc.addEventListener("open", () => {
        setIsSessionActive(true);
    });

    return { peerConnection: pc, audioElement };
}

export function stopWebRTCConnection(peerConnection, dataChannel) {
    if (dataChannel) {
        dataChannel.close();
    }
    if (peerConnection) {
        peerConnection.close();
    }
}

export function sendClientEvent(dataChannel, message, setEvents) {
    if (!dataChannel || !message) {
        console.error("Failed to send message - invalid data channel or message", { dataChannel, message });
        return;
    }
    message.event_id = message.event_id || crypto.randomUUID();
    dataChannel.send(JSON.stringify(message));
    setEvents((prev) => [message, ...prev]);
}
