import type { ITemplateEngine, TemplateResult } from "../../core";

export interface HandlebarsTemplateConfig {
  templates: Record<string, { title: string; body: string; html?: string }>;
}

/**
 * Template engine implementation using Handlebars
 */
export class HandlebarsTemplateEngine implements ITemplateEngine {
  private handlebars: any = null;
  private compiledTemplates: Map<string, any> = new Map();

  constructor(private readonly config: HandlebarsTemplateConfig) {}

  /**
   * Initialize Handlebars lazily
   */
  private async getHandlebars(): Promise<any> {
    if (this.handlebars) {
      return this.handlebars;
    }

    const Handlebars = await import("handlebars");
    this.handlebars = Handlebars.default || Handlebars;

    return this.handlebars;
  }

  async render(_templateId: string, _variables: Record<string, unknown>): Promise<TemplateResult> {
    const template = this.config.templates[_templateId];

    if (!template) {
      throw new Error(`Template ${_templateId} not found`);
    }

    const handlebars = await this.getHandlebars();

    // Compile and cache templates
    if (!this.compiledTemplates.has(_templateId)) {
      const compiled = {
        title: handlebars.compile(template.title),
        body: handlebars.compile(template.body),
        html: template.html ? handlebars.compile(template.html) : undefined,
      };
      this.compiledTemplates.set(_templateId, compiled);
    }

    const compiled = this.compiledTemplates.get(_templateId)!;

    return {
      title: compiled.title(_variables),
      body: compiled.body(_variables),
      html: compiled.html ? compiled.html(_variables) : undefined,
    };
  }

  async hasTemplate(_templateId: string): Promise<boolean> {
    return !!this.config.templates[_templateId];
  }

  async validateVariables(
    _templateId: string,
    _variables: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      await this.render(_templateId, _variables);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Simple template engine using string replacement
 */
export class SimpleTemplateEngine implements ITemplateEngine {
  constructor(
    private readonly templates: Record<string, { title: string; body: string; html?: string }>,
  ) {}

  async render(_templateId: string, _variables: Record<string, unknown>): Promise<TemplateResult> {
    const template = this.templates[_templateId];

    if (!template) {
      throw new Error(`Template ${_templateId} not found`);
    }

    const result: TemplateResult = {
      title: this.replaceVariables(template.title, _variables),
      body: this.replaceVariables(template.body, _variables),
    };

    if (template.html) {
      result.html = this.replaceVariables(template.html, _variables);
    }

    return result;
  }

  async hasTemplate(_templateId: string): Promise<boolean> {
    return !!this.templates[_templateId];
  }

  async validateVariables(
    _templateId: string,
    _variables: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      await this.render(_templateId, _variables);
      return true;
    } catch {
      return false;
    }
  }

  private replaceVariables(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : "";
    });
  }
}
