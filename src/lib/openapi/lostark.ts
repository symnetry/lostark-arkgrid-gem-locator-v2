/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface ArmoryProfile {
  CharacterImage?: string;
  /** @format int32 */
  ExpeditionLevel?: number;
  /**
   * @format int32
   * @default "null"
   */
  TownLevel?: number;
  TownName?: string;
  Title?: string;
  GuildMemberGrade?: string;
  GuildName?: string;
  /** @format int32 */
  UsingSkillPoint?: number;
  /** @format int32 */
  TotalSkillPoint?: number;
  Stats?: Stat[];
  Tendencies?: Tendency[];
  CombatPower?: string;
  Decorations?: Decoration;
  /** @format int32 */
  HonorPoint?: number;
  ServerName?: string;
  CharacterName?: string;
  /** @format int32 */
  CharacterLevel?: number;
  CharacterClassName?: string;
  ItemAvgLevel?: string;
}

export interface Stat {
  Type?: string;
  Value?: string;
  Tooltip?: string[];
}

export interface Tendency {
  Type?: string;
  /** @format int32 */
  Point?: number;
  /** @format int32 */
  MaxPoint?: number;
}

export interface Decoration {
  Symbol?: string;
  Emblems?: string[];
}

export interface ArmoryEquipment {
  Type?: string;
  Name?: string;
  Icon?: string;
  Grade?: string;
  Tooltip?: string;
}

export interface ArmoryAvatar {
  Type?: string;
  Name?: string;
  Icon?: string;
  Grade?: string;
  IsSet?: boolean;
  IsInner?: boolean;
  Tooltip?: string;
}

export interface ArmorySkill {
  Name?: string;
  Icon?: string;
  /** @format int32 */
  Level?: number;
  Type?: string;
  /** @format int32 */
  SkillType?: number;
  Tripods?: SkillTripod[];
  Rune?: SkillRune;
  Tooltip?: string;
}

export interface SkillTripod {
  /** @format int32 */
  Tier?: number;
  /** @format int32 */
  Slot?: number;
  Name?: string;
  Icon?: string;
  IsSelected?: boolean;
  Tooltip?: string;
}

export interface SkillRune {
  Name?: string;
  Icon?: string;
  Grade?: string;
  Tooltip?: string;
}

export interface ArmoryEngraving {
  Engravings?: Engraving[];
  Effects?: EngravingEffect[];
  ArkPassiveEffects?: ArkPassiveEffect[];
}

export interface Engraving {
  /** @format int32 */
  Slot?: number;
  Name?: string;
  Icon?: string;
  Tooltip?: string;
}

export interface EngravingEffect {
  Icon?: string;
  Name?: string;
  Description?: string;
}

export interface ArkPassiveEffect {
  /**
   * @format int32
   * @default "null"
   */
  AbilityStoneLevel?: number;
  Grade?: string;
  /** @format int32 */
  Level?: number;
  Name?: string;
  Description?: string;
}

export interface ArmoryCard {
  Cards?: Card[];
  Effects?: CardEffect[];
}

export interface Card {
  /** @format int32 */
  Slot?: number;
  Name?: string;
  Icon?: string;
  /** @format int32 */
  AwakeCount?: number;
  /** @format int32 */
  AwakeTotal?: number;
  Grade?: string;
  Tooltip?: string;
}

export interface CardEffect {
  /** @format int32 */
  Index?: number;
  CardSlots?: number[];
  Items?: Effect[];
}

export interface Effect {
  Name?: string;
  Description?: string;
}

export interface ArmoryGem {
  Gems?: Gem[];
  Effects?: ArmoryGemEffect;
}

export interface Gem {
  /** @format int32 */
  Slot?: number;
  Name?: string;
  Icon?: string;
  /** @format int32 */
  Level?: number;
  Grade?: string;
  Tooltip?: string;
}

export interface ArmoryGemEffect {
  Description?: string;
  Skills?: GemEffect[];
}

export interface GemEffect {
  /** @format int32 */
  GemSlot?: number;
  Name?: string;
  Description?: string[];
  Option?: string;
  Icon?: string;
  Tooltip?: string;
}

export interface ColosseumInfo {
  Colosseums?: Colosseum[];
}

export interface Colosseum {
  SeasonName?: string;
  Competitive?: AggregationTeamDeathMatchRank;
  TeamDeathmatch?: AggregationTeamDeathMatch;
  TeamElimination?: AggregationElimination;
  CoOpBattle?: Aggregation;
  OneDeathmatch?: AggregationOneDeathmatch;
  OneDeathmatchRank?: AggregationOneDeathmatch;
}

export interface AggregationTeamDeathMatchRank {
  /** @format int32 */
  Rank?: number;
  RankName?: string;
  RankIcon?: string;
  /** @format int32 */
  RankLastMmr?: number;
  /** @format int32 */
  PlayCount?: number;
  /** @format int32 */
  VictoryCount?: number;
  /** @format int32 */
  LoseCount?: number;
  /** @format int32 */
  TieCount?: number;
  /** @format int32 */
  KillCount?: number;
  /** @format int32 */
  AceCount?: number;
  /** @format int32 */
  DeathCount?: number;
}

export interface AggregationTeamDeathMatch {
  /** @format int32 */
  AssistCount?: number;
  /** @format int32 */
  PlayCount?: number;
  /** @format int32 */
  VictoryCount?: number;
  /** @format int32 */
  LoseCount?: number;
  /** @format int32 */
  TieCount?: number;
  /** @format int32 */
  KillCount?: number;
  /** @format int32 */
  AceCount?: number;
  /** @format int32 */
  DeathCount?: number;
}

export interface AggregationElimination {
  /** @format int32 */
  FirstWinCount?: number;
  /** @format int32 */
  SecondWinCount?: number;
  /** @format int32 */
  ThirdWinCount?: number;
  /** @format int32 */
  FirstPlayCount?: number;
  /** @format int32 */
  SecondPlayCount?: number;
  /** @format int32 */
  ThirdPlayCount?: number;
  /** @format int32 */
  AllKillCount?: number;
  /** @format int32 */
  PlayCount?: number;
  /** @format int32 */
  VictoryCount?: number;
  /** @format int32 */
  LoseCount?: number;
  /** @format int32 */
  TieCount?: number;
  /** @format int32 */
  KillCount?: number;
  /** @format int32 */
  AceCount?: number;
  /** @format int32 */
  DeathCount?: number;
}

export interface Aggregation {
  /** @format int32 */
  PlayCount?: number;
  /** @format int32 */
  VictoryCount?: number;
  /** @format int32 */
  LoseCount?: number;
  /** @format int32 */
  TieCount?: number;
  /** @format int32 */
  KillCount?: number;
  /** @format int32 */
  AceCount?: number;
  /** @format int32 */
  DeathCount?: number;
}

export interface AggregationOneDeathmatch {
  /** @format int32 */
  KillCount?: number;
  /** @format int32 */
  DeathCount?: number;
  /** @format int32 */
  AllKillCount?: number;
  /** @format int64 */
  OutDamage?: number;
  /** @format int64 */
  InDamage?: number;
  /** @format int32 */
  FirstWinCount?: number;
  /** @format int32 */
  SecondWinCount?: number;
  /** @format int32 */
  ThirdWinCount?: number;
  /** @format int32 */
  FirstPlayCount?: number;
  /** @format int32 */
  SecondPlayCount?: number;
  /** @format int32 */
  ThirdPlayCount?: number;
}

export interface Collectible {
  Type?: string;
  Icon?: string;
  /** @format int32 */
  Point?: number;
  /** @format int32 */
  MaxPoint?: number;
  CollectiblePoints?: CollectiblePoint[];
}

export interface CollectiblePoint {
  PointName?: string;
  /** @format int32 */
  Point?: number;
  /** @format int32 */
  MaxPoint?: number;
}

export interface ArkPassive {
  Title?: string;
  IsArkPassive?: boolean;
  Points?: ArkPassivePoint[];
  Effects?: ArkPassiveEffectSkill[];
}

export interface ArkPassivePoint {
  Name?: string;
  /** @format int32 */
  Value?: number;
  Tooltip?: string;
  Description?: string;
}

export interface ArkPassiveEffectSkill {
  Name?: string;
  Description?: string;
  Icon?: string;
  ToolTip?: string;
}

export interface ArkGrid {
  Slots?: ArkGridSlot[];
  Effects?: ArkGridEffect[];
}

export interface ArkGridSlot {
  /** @format int32 */
  Index?: number;
  Icon?: string;
  Name?: string;
  /** @format int32 */
  Point?: number;
  Grade?: string;
  Tooltip?: string;
  Gems?: ArkGridGem[];
}

export interface ArkGridGem {
  /** @format int32 */
  Index?: number;
  Icon?: string;
  IsActive?: boolean;
  Grade?: string;
  Tooltip?: string;
}

export interface ArkGridEffect {
  Name?: string;
  /** @format int32 */
  Level?: number;
  Tooltip?: string;
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, 'body' | 'bodyUsed'>;

export interface FullRequestParams extends Omit<RequestInit, 'body'> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<FullRequestParams, 'body' | 'method' | 'query' | 'path'>;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, 'baseUrl' | 'cancelToken' | 'signal'>;
  securityWorker?: (
    securityData: SecurityDataType | null
  ) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown> extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = 'application/json',
  JsonApi = 'application/vnd.api+json',
  FormData = 'multipart/form-data',
  UrlEncoded = 'application/x-www-form-urlencoded',
  Text = 'text/plain',
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = 'https://developer-lostark.game.onstove.com';
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>['securityWorker'];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) => fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: 'same-origin',
    headers: {},
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === 'number' ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join('&');
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter((key) => 'undefined' !== typeof query[key]);
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key)
      )
      .join('&');
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : '';
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === 'object' || typeof input === 'string')
        ? JSON.stringify(input)
        : input,
    [ContentType.JsonApi]: (input: any) =>
      input !== null && (typeof input === 'object' || typeof input === 'string')
        ? JSON.stringify(input)
        : input,
    [ContentType.Text]: (input: any) =>
      input !== null && typeof input !== 'string' ? JSON.stringify(input) : input,
    [ContentType.FormData]: (input: any) => {
      if (input instanceof FormData) {
        return input;
      }

      return Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === 'object' && property !== null
              ? JSON.stringify(property)
              : `${property}`
        );
        return formData;
      }, new FormData());
    },
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(params1: RequestParams, params2?: RequestParams): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (cancelToken: CancelToken): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams =
      ((typeof secure === 'boolean' ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(
      `${baseUrl || this.baseUrl || ''}${path}${queryString ? `?${queryString}` : ''}`,
      {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData ? { 'Content-Type': type } : {}),
        },
        signal: (cancelToken ? this.createAbortSignal(cancelToken) : requestParams.signal) || null,
        body: typeof body === 'undefined' || body === null ? null : payloadFormatter(body),
      }
    ).then(async (response) => {
      const r = response as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const responseToParse = responseFormat ? response.clone() : response;
      const data = !responseFormat
        ? r
        : await responseToParse[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title Lostark Open API
 * @version v1
 * @baseUrl https://developer-lostark.game.onstove.com
 */
export class Api<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
  armories = {
    /**
     * No description
     *
     * @tags Armories
     * @name ArmoriesGetProfileAll
     * @summary Returns a summary of profile information by a character name.
     * @request GET:/armories/characters/{characterName}
     * @secure
     */
    armoriesGetProfileAll: (
      characterName: string,
      query?: {
        /** Filtering the Data e.g., profiles+equipment+avatars+combat-skills+engravings+cards+gems+colosseums+collectibles+arkpassive+arkgrid */
        filters?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<object, void>({
        path: `/armories/characters/${characterName}`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Armories
     * @name ArmoriesGetProfileInfo
     * @summary Returns a summary of the basic stats by a character name.
     * @request GET:/armories/characters/{characterName}/profiles
     * @secure
     */
    armoriesGetProfileInfo: (characterName: string, params: RequestParams = {}) =>
      this.request<ArmoryProfile, void>({
        path: `/armories/characters/${characterName}/profiles`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Armories
     * @name ArmoriesGetEquipment
     * @summary Returns a summary of the items equipped by a character name.
     * @request GET:/armories/characters/{characterName}/equipment
     * @secure
     */
    armoriesGetEquipment: (characterName: string, params: RequestParams = {}) =>
      this.request<ArmoryEquipment[], void>({
        path: `/armories/characters/${characterName}/equipment`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Armories
     * @name ArmoriesGetAvatars
     * @summary Returns a summary of the avatars equipped by a character name.
     * @request GET:/armories/characters/{characterName}/avatars
     * @secure
     */
    armoriesGetAvatars: (characterName: string, params: RequestParams = {}) =>
      this.request<ArmoryAvatar[], void>({
        path: `/armories/characters/${characterName}/avatars`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Armories
     * @name ArmoriesGetSkills
     * @summary Returns a summary of the combat skills by a character name.
     * @request GET:/armories/characters/{characterName}/combat-skills
     * @secure
     */
    armoriesGetSkills: (characterName: string, params: RequestParams = {}) =>
      this.request<ArmorySkill[], void>({
        path: `/armories/characters/${characterName}/combat-skills`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Armories
     * @name ArmoriesGetEngrave
     * @summary Returns a summary of the engravings equipped by a character name.
     * @request GET:/armories/characters/{characterName}/engravings
     * @secure
     */
    armoriesGetEngrave: (characterName: string, params: RequestParams = {}) =>
      this.request<ArmoryEngraving, void>({
        path: `/armories/characters/${characterName}/engravings`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Armories
     * @name ArmoriesGetCard
     * @summary Returns a summary of the cards equipped by a character name.
     * @request GET:/armories/characters/{characterName}/cards
     * @secure
     */
    armoriesGetCard: (characterName: string, params: RequestParams = {}) =>
      this.request<ArmoryCard, void>({
        path: `/armories/characters/${characterName}/cards`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Armories
     * @name ArmoriesGetGem
     * @summary Returns a summary of the gems equipped by a character name.
     * @request GET:/armories/characters/{characterName}/gems
     * @secure
     */
    armoriesGetGem: (characterName: string, params: RequestParams = {}) =>
      this.request<ArmoryGem, void>({
        path: `/armories/characters/${characterName}/gems`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Armories
     * @name ArmoriesGetColosseumInfo
     * @summary Returns a summary of the proving grounds by a character name.
     * @request GET:/armories/characters/{characterName}/colosseums
     * @secure
     */
    armoriesGetColosseumInfo: (characterName: string, params: RequestParams = {}) =>
      this.request<ColosseumInfo, void>({
        path: `/armories/characters/${characterName}/colosseums`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Armories
     * @name ArmoriesGetCollections
     * @summary Returns a summary of the collectibles by a character name.
     * @request GET:/armories/characters/{characterName}/collectibles
     * @secure
     */
    armoriesGetCollections: (characterName: string, params: RequestParams = {}) =>
      this.request<Collectible[], void>({
        path: `/armories/characters/${characterName}/collectibles`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Armories
     * @name ArmoriesGetArkPassive
     * @summary Returns a summary of the ark passive by a character name.
     * @request GET:/armories/characters/{characterName}/arkpassive
     * @secure
     */
    armoriesGetArkPassive: (characterName: string, params: RequestParams = {}) =>
      this.request<ArkPassive, void>({
        path: `/armories/characters/${characterName}/arkpassive`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Armories
     * @name ArmoriesGetArkGrid
     * @summary Returns a summary of the ark grid by a character name.
     * @request GET:/armories/characters/{characterName}/arkgrid
     * @secure
     */
    armoriesGetArkGrid: (characterName: string, params: RequestParams = {}) =>
      this.request<ArkGrid, void>({
        path: `/armories/characters/${characterName}/arkgrid`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),
  };
}
