---
title: (Django) 5. 유저 및 상세 경로 설정
post_order: 5
thumbnail: https://velog.velcdn.com/images/duo22088/post/2511b099-4ce2-49f1-a942-aa41f224406c/djang_thumb.png
layout: post
author: jhj
categories:
  - StudyLog
  - Django
tags:
  - Django
  - categories
  - command
excerpt: 사용자(User) DB 설정 및 상세 페이지 url 설정 방법
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# User

> id 같은 개념?
> 
- admin 계정 혹은 회원가입 등에서 생성 가능
- ForeignKey로 사용
    - 1:N 대응 가능
    - `to` : 기준 키 설정

```python
class ForeignKey(
    to: type[_M@ForeignKey] | str,
    on_delete: _OnDeleteOptions,
    *,
    to_field: str | None = ...,
    related_name: str | None = ...,
    related_query_name: str | None = ...,
    limit_choices_to: _ChoicesLimit | None = ...,
    parent_link: bool = ...,
    db_constraint: bool = ...,
    ...
```

- `models.ForeignKey(on_delete=<option>)` : ForeignKey로 설정
    - `models.CASCADE` : User가 없다면 post 자체를 없애겠다(user 삭제 -> user가 쓴 글 같이 삭제)
    - `models.SET_NULL` : User가 없어도 post는 유지

![image.png](/assets/images/study_log/Django/2025-09-18-categories/image.png)

---

```python
# blog\models.py

from django.contrib.auth.models import User
...

class Post(models.Model):
    author = models.ForeignKey(
    	User, 
    	# on_delete=models.CASCADE,    # User가 없다면 post 자체를 없애겠다(user 삭제 -> user가 쓴 글 같이 삭제)
    	on_delete=models.SET_NULL,    # User가 없어도 post는 유지
        null=True,
    )
...    

```

# Category

> post - category 1:1 대응
ForeignKey 사용
> 
- `name` : name
- `slug` : category 구별에 사용하는 개별 key
    - `unique=True` : 중복을 허용하지 않도록 설정
    - `url` 설정

```python
class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True, allow_unicode=True)    # 중복 방지
    
    def __str__(self):
        return super().__str__()

    def get_absolute_url(self):
        return f'/blog/categories/{self.slug}/'  # return url 지정

class Post(models.Model):
    ...
    
    category = models.ForeignKey(Category, 
                            #    on_delete=models.CASCADE,    # User가 없다면 post 자체를 없애겠다(user 삭제 -> user가 쓴 글 같이 삭제)
                               on_delete=models.SET_NULL,    # User가 없어도 post는 유지
                               blank=True,
                               null=True,
                               )  
    ...                           
```

---

```python
# blog\urls.py

urlpatterns = [
    ...
    path('categories/<str:slug>/', views.categories, name='categories'), # 127.0.0.1:8000/blog/categories/{slug}/
		...
```

- `(models.Model).objects.get(slug=<slug>)` : return `<slug>` 을 가진 `models.Model` 객체
- `(models.Model).objects.filter(category=<obj>)` : return `models.Model`을 가진 객체

```python
# blog\views.py
...
def categories(request, slug):
    if slug=='0':
        category_posts = Post.objects.filter(category=None)
        posts_category = ''
    else :
        posts_category = Category.objects.get(slug=slug)
        category_posts = Post.objects.filter(category=posts_category)
    
    return render(request,
                  template_name='blog/categories.html',
                  context={'category_posts':category_posts,
                           'category' : posts_category,
                           'categories' : category_total_list,
                            },
                  )
...
```