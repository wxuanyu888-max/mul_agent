/**
 * 测试 JSON 过滤功能
 */
import { filterJsonData, jsonResult } from './src/tools/types.js';

// 测试数据：模拟 MCP 返回的复杂 JSON
const testCases = [
  {
    name: 'MCP 标准格式 - 带 metadata',
    data: {
      content: [
        {
          type: 'text',
          text: '这是实际内容',
          annotations: { priority: 'high', source: 'test' },
          metadata: { timestamp: 1234567890, version: '1.0' },
        },
        {
          type: 'resource',
          resource: {
            uri: 'file://test.txt',
            mimeType: 'text/plain',
            text: '资源内容',
            encoding: 'utf-8',
            size: 1024,
          },
        },
      ],
    },
  },
  {
    name: '深层嵌套 JSON',
    data: {
      title: '文档',
      metadata: { version: '1.0' },
      data: {
        items: [
          {
            id: 1,
            name: 'Item 1',
            details: {
              nested: {
                deep: {
                  value: '深层值',
                  metadata: { hidden: true },
                },
              },
            },
          },
          {
            id: 2,
            name: 'Item 2',
            details: {
              nested: {
                deep: {
                  value: '深层值2',
                  metadata: { hidden: true },
                },
              },
            },
          },
        ],
      },
    },
  },
  {
    name: '超长字符串',
    data: {
      title: '测试',
      content: 'A'.repeat(5000), // 5000 个字符
      metadata: { size: 5000 },
    },
  },
  {
    name: '大型数组',
    data: {
      items: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        metadata: { index: i },
        details: { data: 'x'.repeat(100) },
      })),
    },
  },
  {
    name: 'GitHub API 格式',
    data: {
      id: 123,
      node_id: 'R_xxx',
      name: 'test-repo',
      full_name: 'user/test-repo',
      private: false,
      html_url: 'https://github.com/user/test-repo',
      description: 'A test repository',
      fork: false,
      url: 'https://api.github.com/repos/user/test-repo',
      forks_url: 'https://api.github.com/repos/user/test-repo/forks',
      keys_url: 'https://api.github.com/repos/user/test-repo/keys{/key_id}',
      collaborators_url: 'https://api.github.com/repos/user/test-repo/collaborators{/collaborator}',
      visibility: 'public',
      forks: 0,
      open_issues: 0,
      watchers: 0,
      default_branch: 'main',
      temp_clone_token: null,
      network_count: 0,
      subscribers_count: 0,
      owner: {
        login: 'user',
        id: 1,
        node_id: 'U_xxx',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        gravatar_id: '',
        url: 'https://api.github.com/users/user',
        html_url: 'https://github.com/user',
        followers_url: 'https://api.github.com/users/user/followers',
        following_url: 'https://api.github.com/users/user/following{/other_user}',
        gists_url: 'https://api.github.com/users/user/gists{/gist_id}',
        starred_url: 'https://api.github.com/users/user/starred{/owner}{/repo}',
        subscriptions_url: 'https://api.github.com/users/user/subscriptions',
        organizations_url: 'https://api.github.com/users/user/organizations',
        repos_url: 'https://api.github.com/users/user/repos',
        events_url: 'https://api.github.com/users/user/events{/privacy}',
        received_events_url: 'https://api.github.com/users/user/received_events',
        type: 'User',
        site_admin: false,
      },
      license: {
        key: 'mit',
        name: 'MIT License',
        spdx_id: 'MIT',
        url: 'https://api.github.com/licenses/mit',
        node_id: 'MDc6TGljZW5zZT19',
      },
      permissions: {
        admin: false,
        maintain: false,
        push: false,
        triage: false,
        pull: true,
      },
    },
  },
];

console.log('='.repeat(80));
console.log('测试 JSON 过滤功能');
console.log('='.repeat(80));

for (const tc of testCases) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试: ${tc.name}`);
  console.log('='.repeat(60));

  // 原始大小
  const originalSize = JSON.stringify(tc.data).length;
  console.log(`原始大小: ${originalSize} 字符`);

  // full 模式
  const fullResult = filterJsonData(tc.data, 'full');
  console.log(`\n[full] 保留: ${JSON.stringify(fullResult).length} 字符`);

  // smart 模式
  const smartResult = filterJsonData(tc.data, 'smart');
  const smartSize = JSON.stringify(smartResult, null, 2).length;
  console.log(`[smart] 保留: ${smartSize} 字符 (减少 ${((1 - smartSize / originalSize) * 100).toFixed(1)}%)`);
  console.log('[smart] 结果预览:');
  console.log(JSON.stringify(smartResult, null, 2).slice(0, 500));
  if (JSON.stringify(smartResult, null, 2).length > 500) {
    console.log('... (截断)');
  }

  // minimal 模式
  const minimalResult = filterJsonData(tc.data, 'minimal');
  const minimalSize = JSON.stringify(minimalResult, null, 2).length;
  console.log(`\n[minimal] 保留: ${minimalSize} 字符 (减少 ${((1 - minimalSize / originalSize) * 100).toFixed(1)}%)`);
  console.log('[minimal] 结果预览:');
  console.log(JSON.stringify(minimalResult, null, 2).slice(0, 500));
  if (JSON.stringify(minimalResult, null, 2).length > 500) {
    console.log('... (截断)');
  }
}

console.log('\n' + '='.repeat(80));
console.log('测试 jsonResult 函数');
console.log('='.repeat(80));

// 测试 jsonResult
const result1 = jsonResult(testCases[0].data, { level: 'smart' });
console.log('\n[jsonResult smart]');
console.log(result1.content.slice(0, 300));

const result2 = jsonResult(testCases[0].data, { level: 'minimal' });
console.log('\n[jsonResult minimal]');
console.log(result2.content);
