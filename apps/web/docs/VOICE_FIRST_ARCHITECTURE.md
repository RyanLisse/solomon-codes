# Voice-First Architecture Implementation

## Overview

This document describes the implementation of the Letta voice-first architecture for solomon_codes, transforming the application from a traditional web interface into an agent-mediated conversational AI system with persistent memory and learning capabilities.

## Architecture Components

### 1. Voice Processing Layer

#### OpenAI Realtime API Service (`/lib/voice/openai-realtime.ts`)

- Real-time voice-to-voice conversations using WebSocket connections
- Function calling integration for Letta agent communication
- Audio streaming with PCM16 format support
- Session management and configuration

#### Speech Processing Service (`/lib/voice/speech-processing.ts`)

- Multi-provider speech-to-text and text-to-speech
- Web Speech API integration for browser-native processing
- OpenAI Whisper integration for high-accuracy transcription
- Automatic provider fallback and selection

#### Gemini TTS Service (`/lib/voice/gemini-tts.ts`)

- Advanced text-to-speech with style control
- Multi-speaker conversation generation
- 30+ voice options with personality traits
- Natural language style instructions

### 2. Agent Orchestration Layer

#### Agent Router (`/lib/voice/agent-orchestration.ts`)

- Intelligent message routing based on intent detection
- Pattern-based agent selection with priority scoring
- Context-aware agent handoff with memory preservation
- Conversation state management

#### Specialized Agents (`/lib/voice/specialized-agents.ts`)

- **Voice Agent**: Natural conversation and speech processing
- **Code Agent**: Code generation with VibeKit integration
- **Task Agent**: Project management with GitHub integration
- Memory blocks for persistent context and learning

### 3. User Interface Components

#### Enhanced Voice Dictation Button (`/components/voice/enhanced-voice-dictation-button.tsx`)

- Microphone button for speech-to-text input
- Real-time transcription display
- Multiple provider support (Web Speech API, OpenAI Whisper)
- Audio quality enhancement and error handling

#### Enhanced Voice Conversation Button (`/components/voice/enhanced-voice-conversation-button.tsx`)

- Real-time voice-to-voice conversations
- OpenAI Realtime API integration
- Audio level monitoring and visualization
- Letta agent integration indicators

#### Voice-First Interface (`/components/voice/voice-first-interface.tsx`)

- Main integration component
- Agent status and switching
- Provider selection and configuration
- Comprehensive error handling

### 4. API Routes

#### Transcription API (`/api/voice/transcribe/route.ts`)

- Speech-to-text conversion endpoint
- Multi-provider support
- File upload handling
- Language detection

#### Synthesis API (`/api/voice/synthesize/route.ts`)

- Text-to-speech conversion endpoint
- Style and emotion control
- Multiple voice options
- Format conversion

#### Agents API (`/api/voice/agents/route.ts`)

- Letta agent communication
- Session management
- Context preservation
- Agent orchestration

#### Realtime Proxy (`/api/voice/realtime/route.ts`)

- OpenAI Realtime API configuration
- Authentication handling
- Session validation

## Key Features

### 1. Dual Voice Interface

**Dictation Mode (Microphone Button)**

- Click-to-dictate functionality
- Real-time transcription preview
- Text field population
- Edit before sending capability

**Conversation Mode (Voice Button)**

- Real-time voice-to-voice chat
- OpenAI Realtime API integration
- Continuous conversation flow
- Agent integration with function calling

### 2. Multi-Provider Support

**Speech-to-Text Providers**

- Web Speech API (browser-native, real-time)
- OpenAI Whisper (high accuracy, API-based)
- Automatic fallback and provider selection

**Text-to-Speech Providers**

- OpenAI TTS (high quality, fast)
- Google Gemini TTS (advanced style control)
- Web Speech API (browser-native)

### 3. Letta Agent Integration

**Agent Types**

- Voice Agent: Natural conversation and speech processing
- Code Agent: Programming assistance with VibeKit integration
- Task Agent: Project management with GitHub integration

**Memory System**

- Persistent memory blocks per agent
- Conversation history with semantic search
- User preferences and context learning
- Cross-agent memory sharing

**Agent Orchestration**

- Intent-based routing
- Context-aware handoffs
- Memory preservation during switches
- Visual feedback for agent transitions

### 4. Advanced Features

**Multimodal Input**

- Voice + image/screenshot analysis
- OCR and visual content extraction
- Combined context for rich interactions

**Audio Enhancement**

- Echo cancellation and noise suppression
- Automatic gain control
- Audio level monitoring and visualization

**Error Handling**

- Graceful degradation
- Provider fallback
- User-friendly error messages
- Recovery mechanisms

## Configuration

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key

# Google AI Configuration
GOOGLE_AI_API_KEY=your_google_ai_api_key
NEXT_PUBLIC_GOOGLE_AI_API_KEY=your_google_ai_api_key

# Letta Configuration
LETTA_API_KEY=your_letta_api_key
LETTA_BASE_URL=https://api.letta.com
NEXT_PUBLIC_LETTA_API_URL=https://api.letta.com

# Voice Processing
VOICE_PROCESSING_PROVIDER=auto
VOICE_DEFAULT_LANGUAGE=en-US
VOICE_DEFAULT_MODEL=gpt-4o-realtime-preview-2024-12-17
VOICE_DEFAULT_VOICE=coral

# Feature Flags
ENABLE_VOICE_DICTATION=true
ENABLE_VOICE_CONVERSATION=true
ENABLE_LETTA_INTEGRATION=true
ENABLE_MULTIMODAL_INPUT=true
```

### Audio Configuration

```bash
AUDIO_SAMPLE_RATE=24000
AUDIO_CHANNELS=1
AUDIO_FORMAT=pcm16
```

## Usage Examples

### Basic Voice Dictation

```tsx
import { EnhancedVoiceDictationButton } from "@/components/voice/enhanced-voice-dictation-button";

<EnhancedVoiceDictationButton
  onTranscription={(text) => console.log("Transcribing:", text)}
  onDictationComplete={(text) => setInputValue(text)}
  language="en-US"
  useAPI={true}
  showSettings={true}
/>;
```

### Voice Conversation

```tsx
import { EnhancedVoiceConversationButton } from "@/components/voice/enhanced-voice-conversation-button";

<EnhancedVoiceConversationButton
  onConversationStart={() => console.log("Conversation started")}
  onMessage={(message, isUser) => addMessage(message, isUser)}
  enableLettaIntegration={true}
  sessionId="user-session-123"
  userId="user-456"
/>;
```

### Complete Voice Interface

```tsx
import { VoiceFirstInterface } from "@/components/voice/voice-first-interface";

<VoiceFirstInterface
  onTextInput={(text) => handleTextInput(text)}
  onVoiceMessage={(message, isUser) => handleVoiceMessage(message, isUser)}
  enableLettaIntegration={true}
  showAgentStatus={true}
  sessionId="session-123"
  userId="user-456"
/>;
```

## API Usage

### Transcription

```javascript
const formData = new FormData();
formData.append("audio", audioBlob);
formData.append("language", "en-US");

const response = await fetch("/api/voice/transcribe", {
  method: "POST",
  body: formData,
});

const result = await response.json();
console.log("Transcript:", result.transcript);
```

### Synthesis

```javascript
const response = await fetch("/api/voice/synthesize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "Hello world",
    voice: "coral",
    provider: "openai",
  }),
});

const result = await response.json();
// result.audioData contains base64-encoded audio
```

### Agent Communication

```javascript
const response = await fetch("/api/voice/agents", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: "Generate a React component",
    sessionId: "session-123",
    userId: "user-456",
  }),
});

const result = await response.json();
console.log("Agent response:", result.response.content);
```

## Testing

Run the comprehensive test suite:

```bash
npm test -- voice-first-integration.test.tsx
```

The tests cover:

- Component rendering and interaction
- Voice processing service functionality
- Agent orchestration
- API integration
- Error handling scenarios

## Performance Considerations

### Audio Processing

- Use 24kHz sample rate for optimal quality/performance balance
- Implement audio buffering for smooth real-time processing
- Monitor memory usage during long conversations

### Network Optimization

- Compress audio data for API calls
- Implement connection pooling for WebSocket connections
- Use streaming for real-time responses

### Memory Management

- Limit conversation history length
- Implement memory cleanup for inactive sessions
- Use efficient data structures for audio processing

## Security Considerations

### API Keys

- Store sensitive keys server-side only
- Use environment variables for configuration
- Implement key rotation policies

### Audio Data

- Process audio data securely
- Implement data retention policies
- Ensure GDPR compliance for voice data

### User Privacy

- Request explicit microphone permissions
- Provide clear privacy controls
- Allow users to delete voice data

## Troubleshooting

### Common Issues

1. **Microphone Access Denied**

   - Check browser permissions
   - Ensure HTTPS in production
   - Provide clear user instructions

2. **WebSocket Connection Failures**

   - Verify API keys
   - Check network connectivity
   - Implement retry logic

3. **Audio Quality Issues**

   - Adjust sample rate settings
   - Enable noise suppression
   - Check microphone hardware

4. **Agent Response Delays**
   - Monitor API response times
   - Implement timeout handling
   - Provide loading indicators

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug
ENABLE_VOICE_LOGGING=true
ENABLE_AGENT_LOGGING=true
```

## Future Enhancements

### Planned Features

- Multi-language support expansion
- Voice biometrics for user identification
- Advanced audio processing (noise reduction, echo cancellation)
- Offline voice processing capabilities
- Voice command shortcuts
- Custom voice training

### Integration Opportunities

- Calendar and scheduling integration
- Email and communication tools
- File system operations
- Third-party service integrations

## Contributing

When contributing to the voice-first architecture:

1. Follow the established patterns for service integration
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Consider accessibility and user experience
5. Test across different browsers and devices

## Support

For issues and questions:

- Check the troubleshooting section
- Review test cases for usage examples
- Consult the API documentation
- File issues with detailed reproduction steps
