<script lang="ts">
  import { toast } from '@zerodevx/svelte-toast';
  import { onMount } from 'svelte';

  import {
    ArkGridAttrs,
    DEFAULT_PROFILE_NAME,
    type LocalizationName,
    LostArkGrades,
  } from '../../lib/constants/enums';
  import {
    ArkGridCoreNameTierMap,
    ArkGridCoreTypes,
    createCore,
  } from '../../lib/models/arkGridCores';
  import {
    ArkGridGemNames,
    type ArkGridGemOption,
    ArkGridGemOptionNames,
    determineGemGrade,
  } from '../../lib/models/arkGridGems';
  import { type ArkGridGem } from '../../lib/models/arkGridGems';
  import { LostArkOpenAPI, apiClient } from '../../lib/openapi';
  import {
    appConfig,
    toggleDarkMode,
    toggleUI,
    updateOpenApiJWT,
  } from '../../lib/state/appConfig.state.svelte';
  import { appLocale, toggleLocale } from '../../lib/state/locale.state.svelte';
  import {
    type WeaponInfo,
    addGem,
    clearCores,
    currentProfileName,
    updateCore,
    updateIsSupporter,
    updateWeapon,
  } from '../../lib/state/profile.state.svelte';

  let importing: boolean = $state(false);
  let locale = $derived(appLocale.current);
  const LDarkMode: LocalizationName = {
    ko_kr: '다크 모드',
    en_us: 'Dark Mode',
  };
  const LOpenAPIConfig: LocalizationName = {
    ko_kr: 'OpenAPI 설정',
    en_us: 'Config OpenAPI',
  };
  const LOpenAPIApply: LocalizationName = {
    ko_kr: 'OpenAPI 데이터 반영',
    en_us: 'Fetch from OpenAPI',
  };

  function parseOpenApiGem(gem: LostArkOpenAPI.ArkGridGem): ArkGridGem {
    // OpenAPI Gem의 tooltip 파싱

    // 1️⃣ HTML 태그 제거
    if (!gem.Tooltip) {
      throw Error('ToolTip 존재');
    }
    const textOnly = gem.Tooltip.replace(/<[^>]*>/g, '');

    // 툴팁 전체에서 이름 추출
    // XXX 만약 '질서의 젬 : 안정'이라는 문구가 안정 젬이 아닌 곳에 나오게 된다면!?
    const gemName = ArkGridGemNames.find((candidate) => textOnly.includes(candidate));
    if (!gemName) {
      throw Error('이름 없음');
    }

    // 2️⃣ 특정 문구에서 정수 추출
    let req = 0,
      point = 0,
      isOrder: boolean | undefined = undefined;

    // 필요한 의지력
    const willMatch = textOnly.match(/필요 의지력 : (\d+)/);
    if (willMatch) {
      req = parseInt(willMatch[1], 10);
    } else {
      throw Error('의지력 파싱 실패');
    }

    // 질서 & 혼돈 포인트
    const orderMatch = textOnly.match(/질서 포인트 : (\d+)/);
    const chaosMatch = textOnly.match(/혼돈 포인트 : (\d+)/);

    if (orderMatch) {
      point = parseInt(orderMatch[1], 10);
      isOrder = true;
    } else {
      if (chaosMatch) {
        point = parseInt(chaosMatch[1], 10);
        isOrder = false;
      } else {
        throw Error('질서 혼돈 포인트 파싱 실패');
      }
    }

    // 3️⃣ [낙인력] Lv.4 등 키-값 쌍 추출
    const keyLevelRegex = /\[([^\]]+)] Lv\.(\d+)/g;
    const gemOptions: ArkGridGemOption[] = [];
    let match;
    while ((match = keyLevelRegex.exec(textOnly)) !== null) {
      const key = match[1].trim();
      const value = parseInt(match[2], 10);
      const optionType = ArkGridGemOptionNames.find((v) => v === key);
      if (!optionType) {
        throw Error('옵션 파싱 실패!');
      }
      gemOptions.push({
        optionType,
        value,
      });
    }
    if (gemOptions.length < 2) {
      throw Error('공용 옵션의 수가 부족합니다.');
    }
    const gemGrade = LostArkGrades.find((v) => gem.Grade === v);
    return {
      name: gemName,
      grade: gemGrade
        ? gemGrade
        : determineGemGrade(req, point, gemOptions[0], gemOptions[1], gemName),
      gemAttr: isOrder ? '질서' : '혼돈',
      req,
      point,
      option1: gemOptions[0],
      option2: gemOptions[1],
    };
  }

  function parseArmoryEquipmentTooltip(tooltip: string) {
    // 장비에서 무기 공격력 고정 수치와 %증가 수치 옵션을 가져와서 반환
    const text = tooltip.replace(/<[^>]*>/g, '');

    const fixedValues: number[] = [];
    const percentValues: number[] = [];

    // 고정 수치: 무기 공격력 +정수
    const fixedRegex = /무기 공격력\ \+(\d+)\b/g;
    let match: RegExpExecArray | null;

    while ((match = fixedRegex.exec(text)) !== null) {
      fixedValues.push(Number(match[1]));
    }

    const fixedRegexBracelet = /(?<!동안 )무기 공격력이 (\d+) 증가한다\./g;
    while ((match = fixedRegexBracelet.exec(text)) !== null) {
      fixedValues.push(Number(match[1]));
    }

    // 3. 퍼센트 수치: 무기 공격력 +실수%
    const percentRegex = /무기 공격력 *\+(\d+\.\d+)%/g;

    while ((match = percentRegex.exec(text)) !== null) {
      percentValues.push(Number(match[1]));
    }

    return { fixedValues, percentValues };
  }

  async function importFromOpenAPI() {
    if (
      !window.confirm(
        `${currentProfileName.current == DEFAULT_PROFILE_NAME ? '입력할' : currentProfileName.current} 캐릭터의 다음 정보를 가져와 현재 프로필에 반영합니다.\n` +
          '- 장착 중인 아크 그리드 코어\n' +
          '- 무기 코어 전투력 계산을 위한 장비\n' +
          '- (선택) 장착 중인 아크 그리드 젬'
      )
    ) {
      return;
    }
    if (!appConfig.current.openApiConfig.jwt) {
      window.alert('OpenAPI JWT가 설정되어 있지 않습니다.');
      return;
    }
    let characterName = null;
    if (currentProfileName.current == DEFAULT_PROFILE_NAME) {
      characterName = window.prompt('정보를 가져올 캐릭터 이름을 입력해주세요.');
      if (characterName === null || characterName.length == 0) return;
    } else {
      characterName = currentProfileName.current;
    }
    if (characterName === null) return;
    characterName = characterName.trim();

    let confirmAddingGems: boolean | null = null;

    try {
      // fetch
      const res = await apiClient.armories.armoriesGetProfileAll(characterName, {
        filters: 'arkpassive+arkgrid+equipment',
      });
      // apiClient가 ok가 아니라면 알아서 error로 던져줌
      // 하지만 데이터가 없는 경우 null로 오는 걸 캐치
      if (!res.data) {
        window.alert(`${currentProfileName.current}의 정보를 가져올 수 없습니다.`);
        return;
      }
      window.gtag?.('event', 'import-from-open-api', {
        event_label: 'success',
      });
      const data = res.data as Record<string, unknown>;
      const arkpassive = data['ArkPassive'] as LostArkOpenAPI.ArkPassive | undefined;
      const arkgrid = data['ArkGrid'] as LostArkOpenAPI.ArkGrid | undefined;
      const armoryEquipment = data['ArmoryEquipment'] as
        | LostArkOpenAPI.ArmoryEquipment[]
        | undefined;

      let isSupporter = false;

      // 장비에서 무기 공격력 추출
      const weapon: WeaponInfo = { fixed: 0, percent: 0 };
      if (armoryEquipment) {
        for (const equipment of armoryEquipment) {
          if (equipment.Tooltip) {
            const { fixedValues, percentValues } = parseArmoryEquipmentTooltip(equipment.Tooltip);
            for (const v of fixedValues) weapon.fixed += v;
            for (const v of percentValues) weapon.percent += v;
          }
        }
      }
      if (arkpassive) {
        const title = arkpassive.Title;
        if (
          title === '만개' ||
          title === '절실한 구원' ||
          title === '축복의 오라' ||
          title === '해방자'
        ) {
          isSupporter = true;
        }

        if (arkpassive.Points) {
          for (const p of arkpassive.Points) {
            if (p.Name == '깨달음') {
              // 깨달음 레벨당 무기 공격력 0.1%
              const rank = p.Description?.match(/(\d+)랭크 (\d+)레벨/);
              if (rank) {
                weapon.percent += 0.1 * Number(rank[2]);
              }
            }
          }
        }
      }
      if (arkgrid?.Slots) {
        if (confirmAddingGems === null) {
          confirmAddingGems = window.confirm(
            '장착 중인 젬을 현재 프로필에 추가하시겠습니까?\n' +
              '⚠️ 이미 추가한 젬이 있을 경우 중복될 수 있습니다.\n' +
              '⚠️ 응답과 상관 없이 나머지 정보는 모두 반영됩니다.'
          );
        }
        // 코어 데이터가 존재하는 경우 갱신 시작
        clearCores();

        // 모든 slot에 대해서
        for (const coreSlot of arkgrid.Slots) {
          if (!coreSlot.Name || !coreSlot.Grade) {
            window.alert(`OpenAPI 응답이 이상합니다. 콘솔 로그를 확인해주세요.`);
            console.log(coreSlot);
            continue;
          }

          // OpenAPI 응답 -> 내부 데이터로 변환
          const coreName = coreSlot.Name;
          const attr = ArkGridAttrs.find((v) => coreName.slice(0, 2) === v);
          const ctype = ArkGridCoreTypes.find((v) => coreName[4] == v);
          const grade = LostArkGrades.find((v) => coreSlot.Grade === v);

          if (!attr || !ctype || !grade) {
            window.alert(`${coreSlot.Grade} ${coreSlot.Name} 파싱 실패`);
            continue;
          }
          // 내부적으로 구분하는 tier
          // 알 수 없으면 2 (그 외)
          let tier = ArkGridCoreNameTierMap[coreSlot.Name.slice(11)] ?? 2;

          // 특별 처리: 무기 코어 딜러는 1, 서폿은 0
          if (isSupporter && coreSlot.Name.slice(11) == '무기') {
            tier = 0;
          }
          // 질서는 tier 없음
          if (attr == '질서') {
            tier = 0;
          }

          // 성공적으로 변환한 코어 저장
          updateCore(attr, ctype, createCore(attr, ctype, grade, isSupporter, weapon, tier));

          // 장착 중인 젬 추가
          // TODO 젬 목록 API
          if (confirmAddingGems) {
            if (coreSlot.Gems) {
              for (let gem of coreSlot.Gems) {
                addGem(parseOpenApiGem(gem));
              }
            }
          }
        }
      }
      updateIsSupporter(isSupporter);
      updateWeapon(weapon.fixed, weapon.percent);
      toast.push(`OpenAPI 데이터 반영 완료.`);
    } catch (e: any) {
      window.alert(`OpenAPI 요청 실패!\n${e.status} ${e.statusText}`);
      console.error(e);
      return;
    } finally {
      importing = false;
    }
  }

  function updateOpenApiConfig() {
    // 값 반영하기
    let jwtInput = window.prompt(
      '로스트아크 OpenAPI JWT를 입력해주세요',
      appConfig.current.openApiConfig.jwt
    );
    if (!jwtInput) {
      return;
    }
    if (jwtInput == appConfig.current.openApiConfig.jwt) return;
    updateOpenApiJWT(jwtInput);
    toast.push('OpenAPI JWT 갱신 완료');
  }
  onMount(() => {
    const jwt = appConfig.current.openApiConfig.jwt;
    if (jwt) {
      apiClient.setSecurityData({ jwt });
    }
  });
</script>

<div class="buttons">
  <button onclick={updateOpenApiConfig} disabled={locale !== 'ko_kr'}
    >{LOpenAPIConfig[locale]}</button
  >
  <button onclick={importFromOpenAPI} disabled={locale !== 'ko_kr'} data-track="import-from-openapi"
    >{LOpenAPIApply[locale]}</button
  >
  <button hidden={!appConfig.current.uiConfig.debugMode} onclick={() => toggleUI('debugMode')}
    >개발자 모드 {appConfig.current.uiConfig.debugMode ? '끄기' : '켜기'}</button
  >
  <button onclick={toggleDarkMode} style="">
    {LDarkMode[locale]}
    <i
      class="fa-solid"
      class:fa-toggle-on={appConfig.current.uiConfig.darkMode}
      class:fa-toggle-off={!appConfig.current.uiConfig.darkMode}
    ></i>
  </button>
  <button onclick={toggleLocale}>Locale {locale}</button>
</div>

<style>
  .buttons {
    display: flex;
    flex-direction: row;
    gap: 10px;
    justify-content: right;
    flex-wrap: wrap;
  }
  button {
    background-color: var(--card);
  }
  button:hover {
    background-color: var(--card-innner);
  }
</style>
