import { basekit, FieldType, field, FieldComponent, FieldCode, NumberFormatter, AuthorizationType, FieldContext } from '@lark-opdev/block-basekit-server-api';
const { t } = field;

// 通过addDomainList添加请求接口的域名
basekit.addDomainList(['dashscope.aliyuncs.com']);
 
async function getTaskRes({
  task_id,
  context
}:{
  task_id: string,
  context: FieldContext
}){
  let res = null;
    res = await context.fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${task_id}`, { // 已经在addDomainList中添加为白名单的请求
      method: 'POST',
      body: JSON.stringify({})
    }, 'auth_id_1').then(res => res.json())
    if (["FAILED", "UNKNOWN"].includes(res.output.task_status)) {
      throw new Error(res.code);
    }else if(res.output.task_status!="SUCCEEDED"){
      return {
        isOk: false,
      };
    }else{
      const content = res.output.video_url;
      const name = content.split('/').slice(-1)[0].split('?')[0];
      return {
        content,
        name,
        isOk: true
      };
    }
}


basekit.addField({
  // 定义捷径的i18n语言资源
  i18n: {
    messages: {
    }
  },
  // 定义捷径的入参
  formItems: [
    {
      key: 'script',
      label: '脚本',
      component: FieldComponent.FieldSelect,
      props: {
        supportType: [FieldType.Text],
      },
      validator: {
        required: true
      }
    },
    {
      key: 'model',
      label: '选择视频生成模型',
      component: FieldComponent.SingleSelect,
      tooltips: [
        {
          type: 'text',
          content: `wanx2.1-t2v-turbo：免费额度200秒，有效期百炼开通后180天内，计费单价0.24元/秒，限流主账号与RAM子账号共用，任务下发接口QPS限制2，同时处理中任务数量2。`
        },
        {
          type: 'text',
          content: `wanx2.1-t2v-plus：免费额度200秒，有效期百炼开通后180天内，计费单价0.70元/秒，限流主账号与RAM子账号共用，任务下发接口QPS限制2，同时处理中任务数量2。`
        }
      ],
      props: {
        options: [
          { label: 'wanx2.1-t2v-turbo', value: 'wanx2.1-t2v-turbo'},
          { label: 'wanx2.1-t2v-plus', value: 'wanx2.1-t2v-plus'},
        ]
      },
      defaultValue: 'wanx2.1-t2v-turbo',
      validator: {
        required: true
      }
    },
    {
      key: "size",
      label: "选择视频生成分辨率",
      component: FieldComponent.SingleSelect,
      tooltips: [
        {
          type: "text",
          content: "生成视频的分辨率。默认值为1280*720。目前支持5档分辨率选择：1280*720、960*960、720*1280、1088*832、832*1088。"
        }
      ],
      props: {
        options: [
          { label: "1280*720", value: "1280*720" },
          { label: "960*960", value: "960*960" },
          { label: "720*1280", value: "720*1280" },
          { label: "1088*832", value: "1088*832" },
          { label: "832*1088", value: "832*1088" }
        ]
      },
      defaultValue: "1280*720",
      validator: {
        required: true
      }
    }
  ],
  authorizations: [
    {
      id: 'auth_id_1',// 授权的id，用于context.fetch第三个参数以区分该请求使用哪个授权
      platform: 'aliyun_bailian',// 需要与之授权的平台,比如baidu(必须要是已经支持的三方凭证,不可随便填写,如果想要支持更多的凭证，请填写申请表单)
      type: AuthorizationType.HeaderBearerToken,
      required: true,// 设置为选填，用户如果填了授权信息，请求中则会携带授权信息，否则不带授权信息
      instructionsUrl: "https://help.aliyun.com/zh/model-studio/developer-reference/get-api-key",// 帮助链接，告诉使用者如何填写这个apikey
      label: '阿里云百炼授权',
      icon: {
        light: '',
        dark: ''
      }
    }
  ],
  // 定义捷径的返回结果类型
  resultType: {
    type: FieldType.Attachment
  },
  // formItemParams 为运行时传入的字段参数，对应字段配置里的 formItems （如引用的依赖字段）
  execute: async (formItemParams, context) => {
    /** 为方便查看日志，使用此方法替代console.log */
    function debugLog(arg: any) {
      console.log(JSON.stringify({
        formItemParams,
        context,
        arg
      }))
    }
    let task_id = null;
    let res = null;
    try {
      const script = formItemParams.script[0].text;
      const size =  formItemParams.size.value;
      const model = formItemParams.model.value;
      res = null;
      res = await context.fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis', { // 已经在addDomainList中添加为白名单的请求
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable'
        },
        body: JSON.stringify({
          model,
          input:{
            prompt: script
          },
          parameters: {
            size
          }
        })
      },'auth_id_1').then(res => res.json())
      if(res.code){
        throw new Error(res.code);
      }
      task_id = res.output.task_id;
      if(task_id == null){
        throw new Error(res.code);
      }
      let name,content;
      while(true){
        const {name:_name, content:_content, isOk} =  await getTaskRes({
          task_id,
          context
        });
        if(isOk){
          name = _name;
          content = _content;
          break;
        }
      }
      return {
        code: FieldCode.Success,
        data: [
          {
            name,
            content,
            contentType: "attachment/url",
          }
        ]
      }
    } catch (e) {
      switch (e.message) {
        // 参数不合法或错误
        case "InvalidParameter":
        case "invalid_request_error":
        case "InvalidParameterError":
        case "BadRequest.EmptyInput":
        case "BadRequest.EmptyParameters":
        case "BadRequest.EmptyModel":
        case "InvalidURL":
        case "InvalidSchema":
        case "InvalidSchemaFormat":
        case "InvalidParameter":
          return {
            code: FieldCode.InvalidArgument, // 参数错误，用户所选配置的内容合法，但代码中未兼容等情况
          };

        // 授权错误
        case "InvalidApiKey":
        case "AccessDenied":
        case "Workspace.AccessDenied":
        case "Model.AccessDenied":
        case "AccessDenied.Unpurchased":
          return {
            code: FieldCode.AuthorizationError, // 授权错误
          };

        // 限流或资源限制
        case "Throttling":
        case "Throttling.RateQuota":
        case "Throttling.AllocationQuota":
        case "LimitRequests":
        case "PrepaidBillOverdue":
        case "PostpaidBillOverdue":
        case "CommodityNotPurchased":
          return {
            code: FieldCode.RateLimit, // 限流
          };

        // 配置错误
        case "ConfigError":
          return {
            code: FieldCode.ConfigError, // 配置错误，用户在配置面板选择的值不合法
          };

        // 资源耗尽
        case "QuotaExhausted":
        case "Free allocated quota exceeded":
          return {
            code: FieldCode.QuotaExhausted, // quota耗尽
          };

        // 付费错误
        case "Arrearage":
          return {
            code: FieldCode.PayError, // 付费错误异常
          };

        // 其他错误
        default:
          return {
            code: FieldCode.Error, // 插件运行失败（通用错误）
          };
      }
    }
  },
});
export default basekit;