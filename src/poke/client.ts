const POKE_API_URL = 'https://poke.com/api/v1/inbound/api-message';

export class PokeClient {
  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('POKE_API_KEY is required');
  }

  async sendMessage(message: string): Promise<void> {
    const response = await fetch(POKE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
    if (!response.ok) {
      throw new Error(`Poke API error: ${response.status} ${response.statusText}`);
    }
  }
}
