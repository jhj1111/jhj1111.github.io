---
title: (Django) 6. 글 작성 및 수정
post_order: 6
thumbnail: https://i2.ruliweb.com/img/23/09/09/18a79e96cfc1344eb.jpeg
layout: post
author: jhj
categories:
  - StudyLog
  - Django
tags:
  - Django
  - categories
  - command
excerpt: post 작성 및 DB 연동 방법
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# create

- html `POST` 요청 → `/create` url→ `view.create` 실행
    - 정상 작성 → DB저장 → 게시판 리스트(기존 경로 등)으로 **redirect**
    - valid하지 않는 경우 → 다시 쓰라고 알림 → postform.html

## html 요청 메소드

> HTTP는 **요청 메서드**를 정의하여, 주어진 리소스에 수행하길 원하는 행동을 나타냅니다. 간혹 요청 메서드를 "HTTP 동사"라고 부르기도 합니다. 각각의 메서드는 서로 다른 의미를 구현하지만, 일부 기능은 메서드 집합 간에 서로 공유하기도 합니다. 이를테면 응답 메서드는 [안전](https://developer.mozilla.org/ko/docs/Glossary/Safe)하거나, [캐시 가능](https://developer.mozilla.org/ko/docs/Glossary/Cacheable)하거나, [멱등성](https://developer.mozilla.org/ko/docs/Glossary/Idempotent)을 가질 수 있습니다.
> 

| 메서드(Method) | 설명 | 사용 예시 |
| --- | --- | --- |
| **GET** | 서버에서 **리소스를 조회**. 데이터를 가져오기 위한 요청. | 페이지 로딩, API 조회 등 |
| **POST** | 서버에 **새 리소스를 생성**. 주로 폼 데이터 전송 등에 사용. | 회원가입, 게시글 작성 등 |
| **PUT** | 서버의 **기존 리소스를 전체 수정**. 존재하지 않으면 생성될 수도 있음. | 게시글 전체 수정 |
| **PATCH** | 서버의 **기존 리소스를 부분 수정**. 일부 필드만 업데이트. | 게시글 제목만 수정 등 |
| **DELETE** | 서버의 **리소스를 삭제**. | 게시글 삭제, 계정 삭제 등 |
| **HEAD** | **GET과 동일하되, 응답 본문 없음**. 헤더 정보만 필요할 때 사용. | 리소스 존재 여부 확인 등 |
| **OPTIONS** | 해당 리소스에서 지원하는 **메서드 목록 반환**. | CORS 사전 요청 등 |
| **CONNECT** | **프록시 서버와 터널링을 위해 연결**. 주로 HTTPS에 사용됨. | SSL 터널링 |
| **TRACE** | 요청을 따라가면서 **루프백 테스트 수행**. 보안상 거의 사용하지 않음. | 디버깅용 (실제로는 거의 안 씀) |

## html 설정

- `<form action='' method='post'>`
    - `action` : **event** 발생 시 이동 url, 생략 시 **현재 경로**
    - `method` : post, get 등 처리 방법
        - [http 요청 메서드](https://developer.mozilla.org/ko/docs/Web/HTTP/Reference/Methods)
        - `get` : 처음 form 입력 대기 상태
        - `post` : 입력 완료 후 `action` 이동 및 기타 실행
- {% raw %}`{% csrf_token %}` {% endraw %}: token 발행, 낚시 서버 방지
{% raw %}
```python
# blog\templates\blog\postform.html

<html lang='ko'>
    <body>
        <form action='' method='post'>
            {% csrf_token %}
            {{ form }}
            <input type='summit'>
        </form>
    </body>
```
{% endraw %}
## forms.py

- `html`에서 사용할 form(입력 형식) 설정
    - **고정된 형식** 사용, 오타 조심
    - `model` : 사용할 DB class
    - `fields` : 사용 혹은 입력받을 데이터 속성

```python
# blog\forms.py

from django import forms
from .models import Post

class PostForm(forms.ModelForm):
    class Meta: # class 설명
        model = Post
        fields = ['title', 'content', 'uploaded_image', ...]   
        # 속성값 입력, template, 오타 조심
```

- `view.py` : form request
- `<forms.ModelForm>([request.<types>])` : return `ModelFrom` instance
    - `forms.py`에서 선언한 class(`<forms.ModelForm>`)의 `__call__` 메소드
    - 인자로 `request.POST`, `request.FILES` 등 event를 받음
    - HTML 요청을 받아 ModelForm 형태의 객체 반환
- `<반환된 instance>.save(commit)`
    - `commit=False` : DB에 저장X(commit 미 실행), **model instance 반환**

```python
# blog\views.py

...
def create(request):
    if request.method == 'POST':    # 제출 버튼 
        postform = PostForm(request.POST, request.FILES)
        
        if postform.is_valid(): # 작성 도중 제출 버튼 누른경우
            temp_post = postform.save(commit=False) # 저장 메소드를 가진 객체 반환
            if '--' not in temp_post.title:
                temp_post.save()
                return redirect('/blog/')
            
            temp_post.title += ' injection' # 제출 시 추가 동작 실행
            # temp_post.author = request.user
            temp_post.save() # 정상적인 경우 -> DB 저장
            
            return redirect('/blog/')  # blog로 돌아감
        
    else : # GET 요청, 새글 작성(빈 객체 생성, 랜더링)
        postform = PostForm()
    
    return render(request,
                  template_name='blog/postform.html',
                  context={'postform' : postform},
                  )

def createfake(request):
    post = Post()
    post.title = ' fake post title'
    post.content = 'fake post content'
    post.save()
    
    return redirect('/blog/')
    # return redirect('index')

```

# delete

## views

```python
# blog\views.py

def delete(request, pk):
    posts_pk_list = Post.objects.get(pk=pk)
    posts_pk_list.delete()
    
    return redirect('index')    # return redirect('/blog/')
```

# update

- `create`와 동일
    - 기존 작성 내용(GET) + `create`
    - `postform = PostForm(instance=<post_instance>)` : 기존 객체(instance) 정보(GET) → 이어서 작성

```python
# blog\views.py

...
def create(request, pk=None):
    state = 'create' if pk is None else 'update'
    category_total_list = Category.objects.all() # db SELECT * FROM POST ... ASC
    posts_pk_list = Post.objects.get(pk=pk) if state=='update' else None
 
    
    if request.method == 'POST':    # 제출 버튼 
        postform = PostForm(request.POST, request.FILES) if state=='create' \
        else PostForm(request.POST, request.FILES, instance=posts_pk_list)
            
        
        if postform.is_valid: # 작성 도중 제출 버튼 누른경우
            temp_post = postform.save(commit=False) # 저장 메소드를 가진 객체 반환
            
            temp_post.title = temp_post.title if '--' not in temp_post.title \
                else temp_post.title+' injection' # 제출 시 추가 동작 실행
            temp_post.save() # 정상적인 경우 -> DB 저장
            
            return redirect('index')    # return redirect('/blog/')
        
    else : # GET
        postform = PostForm() if state=='create' else PostForm(instance=posts_pk_list)
    
    return render(request,
                  template_name='blog/postform.html',
                  context={'postform' : postform,
                           'categories' : category_total_list,
                           },
                  )
...
```

# 댓글(comment)

- 글(content)에 종속
    - 1:N 관계
- DB 저장(**ForeignKey** 사용)
    - DB → `models.py` 설정
    - `admin.py` 추가(`admin.site.register(<data_class>)`)
- 포스트와 비슷하나 몇 가지 사항 고려
    - 하나의 포스트 → 다수의 댓글
    - `id` : `django.forms.ModelForm` 객체의 primary key
        - 객체마다 유일한 key
        - django가 자동으로 지정
        - 객체를 구별하는데 사용
        - `url`을 통해 정보 교환

```html
<!-- blog\templates\blog\detail.html -->

...
<div class="col-lg-2">
<a href='/blog/{{ post_pk.pk }}/comment_update/{{ comment.id }}' class="mb-4">
<input type='submit' value='수정' class="btn btn-primary"></input>
</a>
</div>

<div class="col-lg-1">
<a href='/blog/{{ post_pk.pk }}/comment_delete/{{ comment.id }}' class="mb-4">
<input type='submit' value='삭제' class="btn btn-primary"></input>
</a>
</div>
...
```

---

```python
# blog\urls.py

...
urlpatterns = [
...
    path('<int:pk>/comment_delete/<int:id>/', views.comment_delete, name='comment_delete'),
    path('<int:pk>/comment_update/<int:id>/', views.comment_input, name='comment_update'),
...
]
```

---

```python
# blog\views.py

...
def comment_input(request, pk, id=None):
    state = 'create' if id is None else 'update'
    post_pk = Post.objects.get(pk=pk)
    comment = Comment.objects.get(pk=id) if state=='update' else None
    commentform = CommentForm(request.POST) \
	    if state=='create' else CommentForm(request.POST, instance=comment)
    
    if request.method == 'POST' and commentform.is_valid(): # create
        temp_comment = commentform.save(commit=False)
        temp_comment.post = post_pk
        temp_comment.save()
        return redirect(post_pk.get_absolute_url())
    else:    # update
        commentform = CommentForm(instance=comment)
        commentform.id = comment.id
        commentform.pk = comment.pk
        commentform.created_date = comment.created_date
        commentform.updated_date = comment.updated_date
        
        comment.delete()
        return detail(request, post_pk.pk, commentform)
        
    # return render(request,
    #               template_name='blog/detail.html',
    #               context={'commentform':commentform,
    #                        })
    
def comment_delete(request, pk, id):
    post_pk = Post.objects.get(pk=pk)
    comment = Comment.objects.get(pk=id)
    comment.delete()
    
    return redirect(f'/blog/{comment.pk}')
...    

```

- `update`의 경우 `render`를 통해 `url`이동 후 작성이 가능하나 실용성은 없다.